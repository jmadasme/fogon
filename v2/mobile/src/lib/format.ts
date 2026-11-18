export function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hace menos de un minuto";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pago pendiente",
  PENDING_MERCHANT: "Pedido nuevo",
  ACCEPTED: "Aceptado",
  PREPARING: "En preparación",
  READY: "Listo",
  PENDING_COURIER: "Buscando repartidor",
  COURIER_ASSIGNED: "Repartidor asignado",
  PICKED_UP: "En camino",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  COMPLETED: "Completado",
  CANCELLED_BY_CUSTOMER: "Cancelado por cliente",
  CANCELLED_BY_MERCHANT: "Cancelado por local",
  CANCELLED_BY_COURIER: "Cancelado por repartidor",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
  DISPUTED: "En disputa",
};

export const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  AUTHORIZED: "Autorizado",
  PAID: "Pagado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function paymentLabel(status: string) {
  return PAYMENT_LABELS[status] ?? status;
}

export function statusTone(status: string) {
  if (["DELIVERED", "COMPLETED"].includes(status)) return "success";
  if (status.startsWith("CANCELLED") || ["REFUNDED", "EXPIRED"].includes(status))
    return "danger";
  if (["PENDING_MERCHANT", "PENDING_COURIER", "PENDING_PAYMENT"].includes(status))
    return "primary";
  if (
    [
      "ACCEPTED",
      "PREPARING",
      "READY",
      "COURIER_ASSIGNED",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
    ].includes(status)
  )
    return "info";
  return "muted";
}

export function vehicleLabel(vehicle: string) {
  const labels: Record<string, string> = {
    BIKE: "Bicicleta",
    MOTORCYCLE: "Moto",
    CAR: "Auto",
    WALKING: "A pie",
  };
  return labels[vehicle] ?? vehicle;
}
