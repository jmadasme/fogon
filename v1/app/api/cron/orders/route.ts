import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  const now = Date.now();
  const paymentCutoff = new Date(now - 15 * 60 * 1000);
  const merchantCutoff = new Date(now - 5 * 60 * 1000);

  const [expiredPayments, unansweredOrders] = await Promise.all([
    db.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        createdAt: { lt: paymentCutoff },
      },
      select: { id: true },
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
    }),
  ]);

  let expired = 0;
  for (const order of expiredPayments) {
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

  return NextResponse.json({
    ok: true,
    expiredPayments: expired,
    cancelledOrders: cancelled,
    checkedAt: new Date().toISOString(),
  });
}
