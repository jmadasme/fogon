import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { exceedsBodyLimit, SMALL_JSON_BODY_LIMIT } from "@/lib/request";
import { createPayment } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";
import type { PaymentProvider } from "@/lib/payments/types";

const schema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(["MERCADOPAGO", "TRANSBANK", "CASH"]),
});

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limit = rateLimit(`payment:${session.id}`, 8, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos de pago. Espera un minuto." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  if (exceedsBodyLimit(request, SMALL_JSON_BODY_LIMIT)) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const order = await db.order.findUnique({
    where: { id: parsed.data.orderId },
    include: { store: true, payment: true },
  });
  if (!order || order.customerId !== session.id) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }
  if (!["PENDING_PAYMENT", "PENDING_MERCHANT"].includes(order.status)) {
    return NextResponse.json(
      { error: "Este pedido ya no admite pagos." },
      { status: 409 },
    );
  }
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ orderId: order.id });
  }

  const provider = parsed.data.provider as PaymentProvider;
  if (provider === "CASH") {
    await db.$transaction([
      db.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PENDING", paymentProvider: "CASH" },
      }),
      db.payment.updateMany({
        where: { orderId: order.id },
        data: { provider: "CASH", status: "PENDING" },
      }),
    ]);
    return NextResponse.json({ orderId: order.id });
  }

  try {
    const payment = await createPayment(
      {
        id: order.id,
        code: order.code,
        total: order.total,
        customerId: session.id,
        customerName: session.name,
        customerEmail: session.email,
        storeName: order.store.name,
      },
      provider,
    );

    await db.order.update({
      where: { id: order.id },
      data: {
        paymentProvider: payment.provider,
        paymentRef: payment.providerRef,
      },
    });
    await db.payment.updateMany({
      where: { orderId: order.id },
      data: {
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
    });

    if (payment.status === "PAID") {
      await markOrderPaid({
        orderId: order.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        raw: payment.raw,
      });
    }

    return NextResponse.json({
      orderId: order.id,
      redirectUrl: payment.redirectUrl,
      status: payment.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pudimos iniciar el pago.";
    await markPaymentFailed({
      orderId: order.id,
      provider,
      raw: JSON.stringify({ message }),
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
