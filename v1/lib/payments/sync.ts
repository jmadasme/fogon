import "server-only";

import { db } from "@/lib/db";

export async function markOrderPaid(input: {
  orderId: string;
  provider: string;
  providerRef?: string;
  raw?: string;
}) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true },
  });
  if (!order) throw new Error("Pedido no encontrado");

  if (order.paymentStatus === "PAID") return order;

  const cancelled =
    order.status.startsWith("CANCELLED") ||
    ["REFUNDED", "EXPIRED"].includes(order.status);
  const paymentStatus = cancelled ? "REFUND_PENDING" : "PAID";

  return db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        paymentProvider: input.provider,
        paymentRef: input.providerRef,
        status: cancelled
          ? order.status
          : order.status === "PENDING_PAYMENT" || order.status === "PAID"
            ? "PENDING_MERCHANT"
            : order.status,
      },
    });

    if (order.payment) {
      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: paymentStatus,
          provider: input.provider,
          providerRef: input.providerRef,
          raw: input.raw,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: input.provider,
          providerRef: input.providerRef,
          status: paymentStatus,
          amount: order.total,
          raw: input.raw,
        },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_CONFIRMED",
        payload: JSON.stringify({
          provider: input.provider,
          providerRef: input.providerRef,
          late: cancelled,
        }),
      },
    });

    return updated;
  });
}

export async function markPaymentFailed(input: {
  orderId: string;
  provider: string;
  providerRef?: string;
  raw?: string;
}) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true },
  });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.paymentStatus === "PAID") return order;

  return db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    if (order.payment) {
      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: "FAILED",
          provider: input.provider,
          providerRef: input.providerRef,
          raw: input.raw,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: input.provider,
          providerRef: input.providerRef,
          status: "FAILED",
          amount: order.total,
          raw: input.raw,
        },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_FAILED",
        payload: JSON.stringify({
          provider: input.provider,
          providerRef: input.providerRef,
        }),
      },
    });
    return order;
  });
}

export async function markOrderRefunded(orderId: string, reason?: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Pedido no encontrado");

  return db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        cancellationReason: reason,
      },
    });
    await tx.payment.updateMany({
      where: { orderId },
      data: { status: "REFUNDED" },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "REFUNDED",
        payload: JSON.stringify({ reason }),
      },
    });
    return updated;
  });
}
