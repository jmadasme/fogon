import "server-only";

import { db } from "@/lib/db";
import { ACTIVE_ORDER_STATUSES } from "@/lib/constants";
import type { MerchantOrder } from "@/lib/merchant/types";

export async function getMerchantOrders(
  merchantId: string,
): Promise<MerchantOrder[]> {
  const orders = await db.order.findMany({
    where: {
      store: { merchantId },
      OR: [
        { status: { in: ACTIVE_ORDER_STATUSES } },
        { createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
      ],
    },
    include: {
      store: { select: { id: true, name: true, emoji: true, comuna: true } },
      customer: { select: { name: true, phone: true } },
      courier: { include: { user: { select: { name: true, phone: true } } } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  return orders.map((order) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    deliveryMode: order.deliveryMode,
    fulfillment: order.fulfillment,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    serviceFee: order.serviceFee,
    tip: order.tip,
    total: order.total,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    addressLine: order.addressLine,
    comuna: order.comuna,
    instructions: order.instructions,
    pickupPin: order.pickupPin,
    createdAt: order.createdAt.toISOString(),
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    store: order.store,
    customer: order.customer,
    courier: order.courier
      ? {
          id: order.courier.id,
          name: order.courier.user.name,
          phone: order.courier.phone ?? order.courier.user.phone,
          vehicle: order.courier.vehicle,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifiersJson: item.modifiersJson,
      notes: item.notes,
    })),
  }));
}
