import { ORDER_STATUS_LABELS } from "@/lib/constants";

export type OrderLike = {
  status: string;
  deliveryMode: string;
  fulfillment: string;
  customerId: string;
  storeId: string;
  courierId?: string | null;
  paymentStatus: string;
};

export type Actor = {
  id: string;
  role: string;
  merchantStoreIds?: string[];
  courierId?: string | null;
};

const MERCHANT_TRANSITIONS: Record<string, string[]> = {
  PENDING_MERCHANT: ["ACCEPTED", "CANCELLED_BY_MERCHANT"],
  ACCEPTED: ["PREPARING", "CANCELLED_BY_MERCHANT"],
  PREPARING: ["READY", "CANCELLED_BY_MERCHANT"],
  READY: [
    "PENDING_COURIER",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED_BY_MERCHANT",
  ],
  PENDING_COURIER: ["OUT_FOR_DELIVERY", "CANCELLED_BY_MERCHANT"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};

const COURIER_TRANSITIONS: Record<string, string[]> = {
  PENDING_COURIER: ["COURIER_ASSIGNED"],
  COURIER_ASSIGNED: ["PICKED_UP", "CANCELLED_BY_COURIER"],
  PICKED_UP: ["DELIVERED"],
};

const CUSTOMER_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["CANCELLED_BY_CUSTOMER"],
  PENDING_MERCHANT: ["CANCELLED_BY_CUSTOMER"],
};

export function canTransition(
  order: OrderLike,
  nextStatus: string,
  actor: Actor,
) {
  // Los administradores no usan la API de estados: tienen acciones auditadas
  // propias (cancelar/reembolsar) para evitar cambios arbitrarios de estado.
  if (actor.role === "ADMIN" || actor.role === "SUPPORT") return false;

  if (actor.role === "CUSTOMER") {
    return (
      order.customerId === actor.id &&
      (CUSTOMER_TRANSITIONS[order.status] ?? []).includes(nextStatus)
    );
  }

  if (actor.role === "MERCHANT") {
    const ownsStore = actor.merchantStoreIds?.includes(order.storeId);
    if (!ownsStore) return false;
    const allowed = MERCHANT_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) return false;

    if (nextStatus === "PENDING_COURIER") {
      return order.deliveryMode === "DELIVERY" && order.fulfillment !== "OWN";
    }
    if (nextStatus === "OUT_FOR_DELIVERY") {
      return order.deliveryMode === "DELIVERY";
    }
    if (nextStatus === "DELIVERED" && order.status === "READY") {
      return order.fulfillment === "PICKUP";
    }
    return true;
  }

  if (actor.role === "COURIER") {
    if (order.fulfillment !== "PLATFORM") return false;
    if (nextStatus === "COURIER_ASSIGNED") {
      return order.status === "PENDING_COURIER" && !order.courierId;
    }
    if (order.courierId !== actor.courierId) return false;
    return (COURIER_TRANSITIONS[order.status] ?? []).includes(nextStatus);
  }

  return false;
}

export function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function timelineStep(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
    case "PAID":
    case "PENDING_MERCHANT":
      return 0;
    case "ACCEPTED":
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    case "PENDING_COURIER":
    case "COURIER_ASSIGNED":
    case "PICKED_UP":
    case "OUT_FOR_DELIVERY":
      return 3;
    case "DELIVERED":
    case "COMPLETED":
      return TIMELINE_STEPS.length;
    default:
      return -1;
  }
}

export const TIMELINE_STEPS = [
  { title: "Pedido recibido", description: "El local confirmó tu pedido" },
  { title: "En preparación", description: "La cocina está trabajando" },
  { title: "Listo", description: "Empacado y esperando repartidor" },
  { title: "En camino", description: "Tu pedido va hacia ti" },
  { title: "Entregado", description: "Pedido entregado" },
];

export function isCancelled(status: string) {
  return status.startsWith("CANCELLED") || status === "REFUNDED" || status === "EXPIRED";
}

export function isActive(status: string) {
  return !["DELIVERED", "COMPLETED", "REFUNDED", "EXPIRED"].includes(status) && !status.startsWith("CANCELLED");
}
