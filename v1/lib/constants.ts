export type Comuna = {
  name: string;
  lat: number;
  lng: number;
  zone: "Centro" | "Oriente" | "Poniente" | "Norte" | "Sur";
};

export const SANTIAGO_COMUNAS: Comuna[] = [
  { name: "Santiago", lat: -33.4489, lng: -70.6693, zone: "Centro" },
  { name: "Cerrillos", lat: -33.5, lng: -70.7167, zone: "Poniente" },
  { name: "Cerro Navia", lat: -33.4167, lng: -70.7333, zone: "Poniente" },
  { name: "Conchalí", lat: -33.3833, lng: -70.6667, zone: "Norte" },
  { name: "El Bosque", lat: -33.55, lng: -70.6667, zone: "Sur" },
  { name: "Estación Central", lat: -33.45, lng: -70.7, zone: "Centro" },
  { name: "Huechuraba", lat: -33.3667, lng: -70.6333, zone: "Norte" },
  { name: "Independencia", lat: -33.4167, lng: -70.6667, zone: "Norte" },
  { name: "La Cisterna", lat: -33.5333, lng: -70.6667, zone: "Sur" },
  { name: "La Florida", lat: -33.5167, lng: -70.5833, zone: "Sur" },
  { name: "La Granja", lat: -33.5333, lng: -70.6167, zone: "Sur" },
  { name: "La Pintana", lat: -33.5833, lng: -70.6333, zone: "Sur" },
  { name: "La Reina", lat: -33.45, lng: -70.5667, zone: "Oriente" },
  { name: "Las Condes", lat: -33.4167, lng: -70.5833, zone: "Oriente" },
  { name: "Lo Barnechea", lat: -33.35, lng: -70.5167, zone: "Oriente" },
  { name: "Lo Espejo", lat: -33.5167, lng: -70.6833, zone: "Sur" },
  { name: "Lo Prado", lat: -33.45, lng: -70.7333, zone: "Poniente" },
  { name: "Macul", lat: -33.4833, lng: -70.6, zone: "Sur" },
  { name: "Maipú", lat: -33.5167, lng: -70.7667, zone: "Poniente" },
  { name: "Ñuñoa", lat: -33.4569, lng: -70.5975, zone: "Oriente" },
  { name: "Pedro Aguirre Cerda", lat: -33.4833, lng: -70.6667, zone: "Sur" },
  { name: "Peñalolén", lat: -33.4833, lng: -70.5333, zone: "Oriente" },
  { name: "Providencia", lat: -33.4311, lng: -70.6092, zone: "Oriente" },
  { name: "Pudahuel", lat: -33.4333, lng: -70.7667, zone: "Poniente" },
  { name: "Quilicura", lat: -33.3667, lng: -70.7333, zone: "Norte" },
  { name: "Quinta Normal", lat: -33.4333, lng: -70.7, zone: "Poniente" },
  { name: "Recoleta", lat: -33.4167, lng: -70.6333, zone: "Norte" },
  { name: "Renca", lat: -33.4, lng: -70.7167, zone: "Poniente" },
  { name: "San Joaquín", lat: -33.5, lng: -70.6167, zone: "Sur" },
  { name: "San Miguel", lat: -33.5, lng: -70.65, zone: "Sur" },
  { name: "San Ramón", lat: -33.5333, lng: -70.6333, zone: "Sur" },
  { name: "Vitacura", lat: -33.3833, lng: -70.5667, zone: "Oriente" },
  { name: "Puente Alto", lat: -33.6167, lng: -70.5833, zone: "Sur" },
  { name: "San Bernardo", lat: -33.5833, lng: -70.7, zone: "Sur" },
];

export const COMUNA_BY_NAME = new Map(
  SANTIAGO_COMUNAS.map((comuna) => [comuna.name, comuna]),
);

export type Cuisine = {
  name: string;
  emoji: string;
  image: string;
};

export const CUISINES: Record<string, Cuisine> = {
  Chilena: {
    name: "Chilena",
    emoji: "🥘",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
  },
  Japonesa: {
    name: "Japonesa",
    emoji: "🍣",
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
  },
  Italiana: {
    name: "Italiana",
    emoji: "🍕",
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
  },
  Saludable: {
    name: "Saludable",
    emoji: "🥗",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  },
  Café: {
    name: "Café",
    emoji: "☕",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  },
  Pollo: {
    name: "Pollo",
    emoji: "🍗",
    image:
      "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=80",
  },
  Mexicana: {
    name: "Mexicana",
    emoji: "🌮",
    image:
      "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=80",
  },
  Panadería: {
    name: "Panadería",
    emoji: "🥐",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
  },
  Asiática: {
    name: "Asiática",
    emoji: "🍜",
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80",
  },
  Hamburguesas: {
    name: "Hamburguesas",
    emoji: "🍔",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
  },
  Venezolana: {
    name: "Venezolana",
    emoji: "🫓",
    image:
      "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80",
  },
  Peruana: {
    name: "Peruana",
    emoji: "🐟",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
  },
  India: {
    name: "India",
    emoji: "🍛",
    image:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=80",
  },
  Mariscos: {
    name: "Mariscos",
    emoji: "🦐",
    image:
      "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=1200&q=80",
  },
  Parrilla: {
    name: "Parrilla",
    emoji: "🔥",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80",
  },
  Sándwiches: {
    name: "Sándwiches",
    emoji: "🥪",
    image:
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1200&q=80",
  },
};

export const CUISINE_NAMES = Object.keys(CUISINES);

export const DELIVERY_BASE_FEE = 1900;
export const DELIVERY_PER_KM = 300;
export const DELIVERY_MAX_FEE = 4900;
export const SERVICE_FEE_RATE = 0.06;
export const SERVICE_FEE_MIN = 500;
export const SERVICE_FEE_MAX = 1500;
export const COURIER_BASE_PAYOUT = 1300;
export const COURIER_PER_KM = 250;

export const COMMISSION_RATES: Record<string, number> = {
  KITCHEN: 12,
  HYBRID: 17,
  FULL: 22,
};

export const COMMISSION_PLAN_LABELS: Record<string, string> = {
  KITCHEN: "Cocina · 12%",
  HYBRID: "Híbrido · 17%",
  FULL: "Full · 22%",
};

export const ROLE_HOME: Record<string, string> = {
  CUSTOMER: "/",
  MERCHANT: "/merchant",
  COURIER: "/courier",
  ADMIN: "/admin",
  SUPPORT: "/admin",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_PAYMENT: "Pago pendiente",
  PAID: "Pagado",
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

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  AUTHORIZED: "Autorizado",
  PAID: "Pagado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  REFUND_PENDING: "Reembolso pendiente",
  PARTIALLY_REFUNDED: "Reembolso parcial",
};

export const DELIVERY_MODE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Retiro en local",
  OWN: "Reparto propio",
  FREELANCE: "Repartidor Fogón",
  PLATFORM: "Repartidor Fogón",
};

export const ACTIVE_ORDER_STATUSES = [
  "PENDING_MERCHANT",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PENDING_COURIER",
  "COURIER_ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
];

export const TERMINAL_ORDER_STATUSES = [
  "DELIVERED",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_MERCHANT",
  "CANCELLED_BY_COURIER",
  "EXPIRED",
  "REFUNDED",
];
