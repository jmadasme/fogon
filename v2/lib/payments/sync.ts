import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type LockedPaymentOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
};

function mergePaymentMeta(
  existingRaw: string | null | undefined,
  incomingRaw: string | undefined,
) {
  if (!existingRaw || !incomingRaw) return incomingRaw;

  try {
    const existing = JSON.parse(existingRaw) as Record<string, unknown>;
    const incoming = JSON.parse(incomingRaw) as Record<string, unknown>;

    if (existing.flowMethod && !incoming.flowMethod) {
      incoming.flowMethod = existing.flowMethod;
    }
    if (existing.paymentMethod && !incoming.paymentMethod) {
      incoming.paymentMethod = existing.paymentMethod;
    }

    return JSON.stringify(incoming);
  } catch {
    return incomingRaw;
  }
}

async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  const rows = await tx.$queryRaw<LockedPaymentOrder[]>(Prisma.sql`
    SELECT id, status, "paymentStatus", total
    FROM "Order"
    WHERE id = ${orderId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function markOrderPaid(input: {
  orderId: string;
  provider: string;
  providerRef?: string;
  raw?: string;
}) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) throw new Error("Pedido no encontrado");

    // Un callback atrasado no puede revertir un pago ya confirmado, un
    // reembolso ni un contracargo. Es idempotente por diseño.
    if (["PAID", "REFUND_PENDING", "REFUNDED"].includes(order.paymentStatus)) {
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }

    const cancelled =
      order.status.startsWith("CANCELLED") ||
      ["REFUNDED", "EXPIRED"].includes(order.status);
    const paymentStatus = cancelled ? "REFUND_PENDING" : "PAID";

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

    const payment = await tx.payment.findUnique({
      where: { orderId: order.id },
    });
    if (payment) {
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
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) throw new Error("Pedido no encontrado");

    // Un fallo no puede degradar un pedido ya pagado o reembolsado.
    if (["PAID", "REFUND_PENDING", "REFUNDED"].includes(order.paymentStatus)) {
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }

    const payment = await tx.payment.findUnique({
      where: { orderId: order.id },
    });
    const raw = mergePaymentMeta(payment?.raw, input.raw);

    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });

    if (payment) {
      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          status: "FAILED",
          provider: input.provider,
          providerRef: input.providerRef,
          raw,
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
          raw,
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

    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

export async function markOrderRefundedByProvider(input: {
  orderId: string;
  provider: string;
  providerRef?: string;
  raw?: string;
  reason?: string;
}) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) throw new Error("Pedido no encontrado");

    // Idempotente: si ya está en estado terminal de reembolso no se toca.
    if (["REFUND_PENDING", "REFUNDED"].includes(order.paymentStatus)) {
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }

    // Solo un pedido PAID puede pasar a reembolsado por el proveedor.
    if (order.paymentStatus !== "PAID") {
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "REFUNDED",
        status: order.status.startsWith("CANCELLED") ? order.status : "REFUNDED",
      },
    });

    await tx.payment.updateMany({
      where: { orderId: order.id },
      data: { status: "REFUNDED" },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_REFUNDED_BY_PROVIDER",
        payload: JSON.stringify({
          provider: input.provider,
          providerRef: input.providerRef,
          reason: input.reason ?? "Reembolso reportado por la pasarela",
        }),
      },
    });

    // Alerta operativa: contracargos y reembolsos desde el lado del
    // proveedor deben revisarse (posible entrega ya en curso).
    console.error(
      "[alerta] Pago revertido por el proveedor sobre un pedido PAID",
      { orderId: order.id, provider: input.provider, reason: input.reason },
    );

    return updated;
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
