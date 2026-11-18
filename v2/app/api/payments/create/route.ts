import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { BodyTooLargeError, readJsonBody, SMALL_JSON_BODY_LIMIT } from "@/lib/request";
import { createPayment, getFlowPaymentStatus } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";
import type { PaymentProvider } from "@/lib/payments/types";

const schema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(["MERCADOPAGO", "TRANSBANK", "FLOW"]),
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
  try {
    body = await readJsonBody(request, SMALL_JSON_BODY_LIMIT);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
    }
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
  if (["REFUND_PENDING", "REFUNDED"].includes(order.paymentStatus)) {
    return NextResponse.json(
      { error: "Este pedido tiene un reembolso en curso." },
      { status: 409 },
    );
  }

  const provider = parsed.data.provider as PaymentProvider;

  // Si el cliente vuelve a intentar un pago Flow que sigue pendiente,
  // reutilizamos el mismo checkout en vez de crear una segunda orden pagable.
  if (
    provider === "FLOW" &&
    order.paymentProvider === "FLOW" &&
    order.paymentStatus === "PENDING" &&
    order.paymentRef
  ) {
    try {
      const flowStatus = (await getFlowPaymentStatus(order.paymentRef)) as {
        status?: number | string;
        amount?: number | string;
      };

      if (Number(flowStatus.status) === 2) {
        if (Number(flowStatus.amount) !== order.total) {
          return NextResponse.json(
            { error: "El pago está en revisión. Contacta a soporte." },
            { status: 409 },
          );
        }
        await markOrderPaid({
          orderId: order.id,
          provider: "FLOW",
          providerRef: order.paymentRef,
          raw: JSON.stringify(flowStatus),
        });
        return NextResponse.json({ orderId: order.id, status: "PAID" });
      }

      if (Number(flowStatus.status) === 1) {
        let checkoutUrl: string | undefined;
        try {
          const raw = order.payment?.raw
            ? (JSON.parse(order.payment.raw) as { checkoutUrl?: string })
            : null;
          checkoutUrl = raw?.checkoutUrl;
        } catch {
          checkoutUrl = undefined;
        }

        if (checkoutUrl) {
          return NextResponse.json({
            orderId: order.id,
            redirectUrl: checkoutUrl,
            status: "PENDING",
          });
        }
      }
    } catch (error) {
      console.warn("Flow retry: no se pudo consultar el estado", error);
    }
  }

  let flowMethod: "webpay" | "mach" | undefined;
  try {
    const parsed = order.payment?.raw
      ? (JSON.parse(order.payment.raw) as { flowMethod?: string })
      : null;
    if (parsed?.flowMethod === "webpay" || parsed?.flowMethod === "mach") {
      flowMethod = parsed.flowMethod;
    }
  } catch {
    flowMethod = undefined;
  }

  // Un solo intento de pago remoto por pedido. El lock expira a los 2 minutos
  // para no dejar pedidos bloqueados si el proceso muere a mitad de camino.
  const lock = await db.order.updateMany({
    where: {
      id: order.id,
      OR: [
        { paymentLockAt: null },
        { paymentLockAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    },
    data: { paymentLockAt: new Date() },
  });
  if (lock.count !== 1) {
    return NextResponse.json(
      { error: "Ya hay un pago en proceso para este pedido. Espera un momento." },
      { status: 409 },
    );
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
        flowMethod,
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
        raw: payment.raw,
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
  } finally {
    await db.order
      .updateMany({
        where: { id: order.id, paymentLockAt: { not: null } },
        data: { paymentLockAt: null },
      })
      .catch((error) => {
        console.error("No se pudo liberar el lock de pago", error);
      });
  }
}
