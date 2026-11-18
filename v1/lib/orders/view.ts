import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import type { SerializedOrder } from "@/lib/orders/types";

async function serializeOrder(order: {
  id: string;
  code: string;
  status: string;
  deliveryMode: string;
  fulfillment: string;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  discount: number;
  total: number;
  commissionRate: number;
  commissionAmount: number;
  courierPayout: number;
  distanceKm: number;
  paymentStatus: string;
  paymentProvider: string | null;
  addressLine: string;
  comuna: string;
  lat: number;
  lng: number;
  instructions: string | null;
  pickupPin: string;
  deliveryPin: string;
  createdAt: Date;
  acceptedAt: Date | null;
  readyAt: Date | null;
  courierAssignedAt: Date | null;
  pickedUpAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancellationReason: string | null;
  customerId: string;
  store: {
    id: string;
    name: string;
    slug: string;
    emoji: string;
    cuisine: string;
    address: string;
    comuna: string;
    lat: number;
    lng: number;
    prepTimeMin: number;
    phone: string | null;
    merchant: { deliveryMode: string; ownerId: string };
  };
  courier: {
    id: string;
    userId: string;
    phone: string | null;
    vehicle: string;
    rating: number;
    currentLat: number | null;
    currentLng: number | null;
    user: { name: string; phone: string | null };
  } | null;
  items: {
    id: string;
    nameSnapshot: string;
    quantity: number;
    unitPrice: number;
    modifiersJson: string | null;
    notes: string | null;
  }[];
  events: { id: string; type: string; payload: string | null; createdAt: Date }[];
  payment: { provider: string; status: string; amount: number } | null;
  reviews: { id: string; authorId: string }[];
}, viewer: SessionUser): Promise<SerializedOrder> {
  const isAdmin = viewer.role === "ADMIN" || viewer.role === "SUPPORT";
  const isCustomer = order.customerId === viewer.id;
  const isMerchant = order.store.merchant.ownerId === viewer.id;
  const isCourier = order.courier?.userId === viewer.id;
  const activeDelivery = [
    "COURIER_ASSIGNED",
    "PICKED_UP",
    "OUT_FOR_DELIVERY",
  ].includes(order.status);
  const showCustomerAddress = !isCourier || activeDelivery;

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    deliveryMode: order.deliveryMode,
    fulfillment: order.fulfillment,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    serviceFee: order.serviceFee,
    tip: order.tip,
    discount: order.discount,
    total: order.total,
    commissionRate: order.commissionRate,
    commissionAmount: order.commissionAmount,
    courierPayout: order.courierPayout,
    distanceKm: order.distanceKm,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    addressLine: showCustomerAddress ? order.addressLine : "",
    comuna: order.comuna,
    lat: showCustomerAddress ? order.lat : 0,
    lng: showCustomerAddress ? order.lng : 0,
    instructions: showCustomerAddress ? order.instructions : null,
    pickupPin:
      viewer.role === "ADMIN" || isMerchant ? order.pickupPin : undefined,
    deliveryPin:
      viewer.role === "ADMIN" || isCustomer ? order.deliveryPin : undefined,
    createdAt: order.createdAt.toISOString(),
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    courierAssignedAt: order.courierAssignedAt?.toISOString() ?? null,
    pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
    outForDeliveryAt: order.outForDeliveryAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
    store: {
      id: order.store.id,
      name: order.store.name,
      slug: order.store.slug,
      emoji: order.store.emoji,
      cuisine: order.store.cuisine,
      address: order.store.address,
      comuna: order.store.comuna,
      lat: order.store.lat,
      lng: order.store.lng,
      prepTimeMin: order.store.prepTimeMin,
      phone: order.store.phone,
      merchantDeliveryMode: order.store.merchant.deliveryMode,
    },
    courier: order.courier
      ? {
          id: order.courier.id,
          name: order.courier.user.name,
          phone:
            isAdmin || activeDelivery
              ? order.courier.phone ?? order.courier.user.phone
              : null,
          vehicle: order.courier.vehicle,
          rating: order.courier.rating,
          currentLat: activeDelivery ? order.courier.currentLat : null,
          currentLng: activeDelivery ? order.courier.currentLng : null,
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
    // No exponer payloads internos: pueden contener providerRef/tokens de pago.
    events: order.events.map((event) => ({
      id: event.id,
      type: event.type,
      payload: null,
      createdAt: event.createdAt.toISOString(),
    })),
    payment: order.payment
      ? {
          provider: order.payment.provider,
          status: order.payment.status,
          amount: order.payment.amount,
        }
      : null,
    reviewed: order.reviews.some((review) => review.authorId === viewer.id),
    canCancel: isCustomer && ["PENDING_MERCHANT", "PENDING_PAYMENT"].includes(order.status),
    canReview: isCustomer && ["DELIVERED", "COMPLETED"].includes(order.status),
    viewerRole: viewer.role,
    isAdminView: isAdmin,
  };
}

export async function getOrderForViewer(id: string, viewer: SessionUser) {
  const order = await db.order.findUnique({
    where: { id },
    include: {
      store: { include: { merchant: true } },
      courier: { include: { user: true } },
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payment: true,
      reviews: true,
    },
  });

  if (!order) {
    return { ok: false as const, status: 404, error: "Pedido no encontrado." };
  }

  const isAdmin = viewer.role === "ADMIN" || viewer.role === "SUPPORT";
  const isCustomer = order.customerId === viewer.id;
  const isMerchant = order.store.merchant.ownerId === viewer.id;
  const isCourier = order.courier?.userId === viewer.id;

  if (!isAdmin && !isCustomer && !isMerchant && !isCourier) {
    return { ok: false as const, status: 403, error: "No autorizado." };
  }

  return {
    ok: true as const,
    order: await serializeOrder(order, viewer),
  };
}
