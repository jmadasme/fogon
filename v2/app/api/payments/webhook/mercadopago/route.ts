/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmMercadoPagoPayment } from "@/lib/payments";
import { verifyMercadoPagoSignature } from "@/lib/payments/mercadopago";
import { markOrderPaid, markPaymentFailed, markOrderRefundedByProvider } from "@/lib/payments/sync";
import { BodyTooLargeError, readJsonBody } from "@/lib/request";

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await readJsonBody(request, 64 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "Payload demasiado grande." },
        { status: 413 },
      );
    }
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
    } else if (result.status === "refunded" || result.status === "charged_back") {
      // Reembolsos y contracargos sobre pedidos PAID no deben caer en el
      // no-op de markPaymentFailed: el dinero ya volvió al comprador y el
      // pedido debe dejar de estar operativo.
      await markOrderRefundedByProvider({
        orderId: result.orderId,
        provider: "MERCADOPAGO",
        providerRef: result.providerRef,
        raw: result.raw,
        reason:
          result.status === "charged_back"
            ? "Contracargo reportado por Mercado Pago"
            : "Reembolso reportado por Mercado Pago",
      });
    } else if (["rejected", "cancelled"].includes(result.status)) {
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
