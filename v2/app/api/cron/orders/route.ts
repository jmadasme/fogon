import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFlowPaymentStatus, refundPayment } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed, markOrderRefunded } from "@/lib/payments/sync";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), secret);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`cron:orders:${ip}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas ejecuciones. Espera un minuto." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const now = Date.now();
  const paymentCutoff = new Date(now - 15 * 60 * 1000);
  const merchantCutoff = new Date(now - 5 * 60 * 1000);

  const flowReconcileCutoff = new Date(now - 2 * 60 * 1000);

  const [flowPending, expiredPayments, unansweredOrders] = await Promise.all([
    db.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentProvider: "FLOW",
        paymentRef: { not: null },
        createdAt: { lt: flowReconcileCutoff },
      },
      select: { id: true, paymentRef: true, total: true },
      take: 50,
    }),
    db.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        createdAt: { lt: paymentCutoff },
      },
      select: {
        id: true,
        paymentProvider: true,
        paymentRef: true,
        total: true,
      },
      take: 200,
    }),
    db.order.findMany({
      where: {
        status: "PENDING_MERCHANT",
        createdAt: { lt: merchantCutoff },
      },
      select: {
        id: true,
        paymentStatus: true,
        paymentProvider: true,
      },
      take: 200,
    }),
  ]);

  let reconciled = 0;
  for (const order of flowPending) {
    if (!order.paymentRef) continue;

    try {
      const status = (await getFlowPaymentStatus(order.paymentRef)) as {
        status?: number | string;
        amount?: number | string;
      };
      const flowStatus = Number(status.status);

      if (flowStatus === 2) {
        if (Math.round(Number(status.amount)) !== order.total) {
          console.error("Flow cron: monto no coincide", {
            orderId: order.id,
            expected: order.total,
            received: status.amount,
          });
          continue;
        }
        await markOrderPaid({
          orderId: order.id,
          provider: "FLOW",
          providerRef: order.paymentRef,
          raw: JSON.stringify(status),
        });
        reconciled += 1;
      } else if (flowStatus === 3 || flowStatus === 4) {
        await markPaymentFailed({
          orderId: order.id,
          provider: "FLOW",
          providerRef: order.paymentRef,
          raw: JSON.stringify(status),
        });
      }
    } catch (error) {
      console.error("Flow cron: no se pudo conciliar", {
        orderId: order.id,
        error,
      });
    }
  }

  let expired = 0;
  for (const order of expiredPayments) {
    if (order.paymentProvider === "FLOW" && order.paymentRef) {
      try {
        const status = (await getFlowPaymentStatus(order.paymentRef)) as {
          status?: number | string;
          amount?: number | string;
        };
        if (
          Number(status.status) === 2 &&
          Math.round(Number(status.amount)) === order.total
        ) {
          await markOrderPaid({
            orderId: order.id,
            provider: "FLOW",
            providerRef: order.paymentRef,
            raw: JSON.stringify(status),
          });
          continue;
        }
      } catch (error) {
        console.error("Flow cron: no se pudo revisar antes de expirar", {
          orderId: order.id,
          error,
        });
      }
    }

    const changed = await db.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED", paymentStatus: "FAILED" },
    });
    if (changed.count === 1) {
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "EXPIRED",
          payload: JSON.stringify({ reason: "Pago no completado en 15 minutos" }),
        },
      });
      expired += 1;
    }
  }

  let cancelled = 0;
  for (const order of unansweredOrders) {
    const paid = order.paymentStatus === "PAID";
    const paymentStatus = paid
      ? order.paymentProvider === "MOCK"
        ? "REFUNDED"
        : "REFUND_PENDING"
      : order.paymentStatus;

    const changed = await db.order.updateMany({
      where: { id: order.id, status: "PENDING_MERCHANT" },
      data: {
        status: "CANCELLED_BY_MERCHANT",
        cancellationReason: "El local no respondió en 5 minutos",
        paymentStatus,
      },
    });
    if (changed.count === 1) {
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "CANCELLED",
          payload: JSON.stringify({
            reason: "El local no respondió en 5 minutos",
            paymentStatus,
          }),
        },
      });
      cancelled += 1;
    }
  }

  // ---- Reembolsos pendientes (REFUND_PENDING huérfanos) ----
  // Tres caminos marcan REFUND_PENDING sin ejecutar el reembolso (cancel
  // admin de un pedido PAID, auto-cancel del cron, cancelación de
  // repartidor/admin). Sin este procesador el dinero quedaba retenido y
  // la acción "Reembolsar" del panel hacía early-return para siempre.
  let refundsProcessed = 0;
  const refundPending = await db.order.findMany({
    where: {
      paymentStatus: "REFUND_PENDING",
      paymentProvider: { in: ["MERCADOPAGO", "TRANSBANK", "CASH", "MOCK"] },
    },
    select: {
      id: true,
      total: true,
      paymentProvider: true,
      paymentRef: true,
    },
    take: 20,
  });

  for (const order of refundPending) {
    // Idempotencia: nunca re-ejecutar un reembolso ya hecho.
    const alreadyExecuted = await db.orderEvent.findFirst({
      where: { orderId: order.id, type: "REFUND_EXECUTED" },
      select: { id: true },
    });
    if (alreadyExecuted) continue;

    // Flow no soporta reembolso por API en esta versión: gestión manual.
    if (order.paymentProvider === "FLOW") continue;

    try {
      if (
        order.paymentProvider === "MERCADOPAGO" ||
        order.paymentProvider === "TRANSBANK"
      ) {
        await refundPayment(order.paymentProvider, order.paymentRef, order.total);
      }
      // CASH/MOCK no tienen pasarela digital: se resuelve como manual.

      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "REFUND_EXECUTED",
          payload: JSON.stringify({
            provider: order.paymentProvider,
            providerRef: order.paymentRef,
            manual: order.paymentProvider === "CASH" || order.paymentProvider === "MOCK",
          }),
        },
      });
      await markOrderRefunded(order.id, "Reembolso procesado automáticamente");
      refundsProcessed += 1;
    } catch (error) {
      console.error("Cron refunds: no se pudo reembolsar", {
        orderId: order.id,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    reconciledFlowPayments: reconciled,
    expiredPayments: expired,
    cancelledOrders: cancelled,
    refundsProcessed,
    checkedAt: new Date().toISOString(),
  });
}
