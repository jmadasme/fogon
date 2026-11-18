/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmMercadoPagoPayment } from "@/lib/payments";
import { verifyMercadoPagoSignature } from "@/lib/payments/mercadopago";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";
import { exceedsBodyLimit } from "@/lib/request";

export async function POST(request: Request) {
  if (exceedsBodyLimit(request, 64 * 1024)) {
    return NextResponse.json(
      { error: "Payload demasiado grande." },
      { status: 413 },
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Mercado Pago también puede enviar notificaciones por query string.
  }

  const url = new URL(request.url);
  const type =
    body?.type ??
    body?.topic ??
    url.searchParams.get("type") ??
    url.searchParams.get("topic");
  const paymentId =
    body?.data?.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  if (type !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!verifyMercadoPagoSignature(request.headers, String(paymentId))) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  try {
    const result = await confirmMercadoPagoPayment(String(paymentId));
    if (!result.orderId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const order = await db.order.findUnique({
      where: { id: result.orderId },
    });
    if (
      !order ||
      (order.paymentProvider !== "MERCADOPAGO" && order.paymentProvider !== "MOCK")
    ) {
      console.warn("Mercado Pago webhook: pedido/proveedor no coincide");
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (result.status === "approved") {
      if (
        Number(result.amount) !== Number(order.total) ||
        (result.currency && result.currency !== "CLP")
      ) {
        console.warn("Mercado Pago webhook: monto/moneda no coincide", {
          orderId: order.id,
        });
        return NextResponse.json({ ok: true, ignored: true });
      }

      await markOrderPaid({
        orderId: result.orderId,
        provider: "MERCADOPAGO",
        providerRef: result.providerRef,
        raw: result.raw,
      });
    } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(result.status)) {
      await markPaymentFailed({
        orderId: result.orderId,
        provider: "MERCADOPAGO",
        providerRef: result.providerRef,
        raw: result.raw,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mercado Pago webhook error", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
