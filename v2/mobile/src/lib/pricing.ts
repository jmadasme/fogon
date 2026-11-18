import { COMUNA_BY_NAME } from "./communes";

export const DELIVERY_BASE_FEE = 1900;
export const DELIVERY_PER_KM = 300;
export const DELIVERY_MAX_FEE = 4900;
export const SERVICE_FEE_RATE = 0.06;
export const SERVICE_FEE_MIN = 500;
export const SERVICE_FEE_MAX = 1500;
export const COURIER_BASE_PAYOUT = 1300;
export const COURIER_PER_KM = 250;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceForComuna(
  store: { lat: number; lng: number; comuna: string },
  comuna: { name: string; lat: number; lng: number },
) {
  if (store.comuna === comuna.name) return 2.4;
  return Math.min(
    14,
    Math.max(
      1.5,
      haversineKm(
        { lat: store.lat, lng: store.lng },
        { lat: comuna.lat, lng: comuna.lng },
      ),
    ),
  );
}

export function calculateFees(input: {
  subtotal: number;
  distanceKm: number;
  deliveryMode: "DELIVERY" | "PICKUP";
  tip: number;
}) {
  const isDelivery = input.deliveryMode === "DELIVERY";
  const distance = isDelivery ? Math.max(0.5, input.distanceKm) : 0;
  const deliveryFee = isDelivery
    ? Math.min(
        DELIVERY_MAX_FEE,
        Math.round(
          (DELIVERY_BASE_FEE + Math.max(0, distance - 2) * DELIVERY_PER_KM) /
            100,
        ) * 100,
      )
    : 0;
  const serviceFee = isDelivery
    ? Math.min(
        SERVICE_FEE_MAX,
        Math.max(
          SERVICE_FEE_MIN,
          Math.round((input.subtotal * SERVICE_FEE_RATE) / 100) * 100,
        ),
      )
    : 0;

  return {
    subtotal: input.subtotal,
    deliveryFee,
    serviceFee,
    tip: input.tip,
    total: input.subtotal + deliveryFee + serviceFee + input.tip,
    distanceKm: Number(distance.toFixed(1)),
  };
}

export function comunaFor(name: string) {
  return COMUNA_BY_NAME.get(name);
}
