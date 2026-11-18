import {
  COURIER_BASE_PAYOUT,
  COURIER_PER_KM,
  DELIVERY_BASE_FEE,
  DELIVERY_MAX_FEE,
  DELIVERY_PER_KM,
  SERVICE_FEE_MAX,
  SERVICE_FEE_MIN,
  SERVICE_FEE_RATE,
} from "@/lib/constants";
import { clamp, haversineKm, roundToHundred } from "@/lib/utils";

export type FeeInput = {
  subtotal: number;
  distanceKm: number;
  deliveryMode: "DELIVERY" | "PICKUP";
  tip: number;
  discount?: number;
  commissionRate: number;
};

export type FeeBreakdown = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  tip: number;
  discount: number;
  total: number;
  distanceKm: number;
  commissionRate: number;
  commissionAmount: number;
  courierPayout: number;
};

export function calculateFees({
  subtotal,
  distanceKm,
  deliveryMode,
  tip,
  discount = 0,
  commissionRate,
}: FeeInput): FeeBreakdown {
  const isDelivery = deliveryMode === "DELIVERY";
  const safeDistance = isDelivery ? Math.max(0.5, distanceKm) : 0;

  const deliveryFee = isDelivery
    ? clamp(
        roundToHundred(
          DELIVERY_BASE_FEE +
            Math.max(0, safeDistance - 2) * DELIVERY_PER_KM,
        ),
        0,
        DELIVERY_MAX_FEE,
      )
    : 0;

  const serviceFee = isDelivery
    ? clamp(
        roundToHundred(subtotal * SERVICE_FEE_RATE),
        SERVICE_FEE_MIN,
        SERVICE_FEE_MAX,
      )
    : 0;

  const commissionAmount = Math.round((subtotal * commissionRate) / 100);
  const courierPayout = isDelivery
    ? Math.round(COURIER_BASE_PAYOUT + COURIER_PER_KM * safeDistance)
    : 0;

  const total = Math.max(
    0,
    subtotal + deliveryFee + serviceFee + tip - discount,
  );

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    tip,
    discount,
    total,
    distanceKm: Number(safeDistance.toFixed(1)),
    commissionRate,
    commissionAmount,
    courierPayout,
  };
}

export function distanceForComuna(
  store: { lat: number; lng: number; comuna: string },
  comuna: { name: string; lat: number; lng: number },
) {
  if (store.comuna === comuna.name) {
    return 2.4;
  }
  const distance = haversineKm(
    { lat: store.lat, lng: store.lng },
    { lat: comuna.lat, lng: comuna.lng },
  );
  return clamp(distance, 1.5, 14);
}
