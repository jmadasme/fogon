import "server-only";

import { haversineKm } from "@/lib/utils";

const SANTIAGO_BOUNDS = {
  minLat: -33.75,
  maxLat: -33.15,
  minLng: -70.95,
  maxLng: -70.35,
};

export function courierSecurityEnforced() {
  return process.env.COURIER_SECURITY_ENFORCED === "true";
}

export function outsideSantiago(lat: number, lng: number) {
  return (
    lat < SANTIAGO_BOUNDS.minLat ||
    lat > SANTIAGO_BOUNDS.maxLat ||
    lng < SANTIAGO_BOUNDS.minLng ||
    lng > SANTIAGO_BOUNDS.maxLng
  );
}

export function maxLocationAgeMs() {
  const minutes = Number(process.env.COURIER_LOCATION_MAX_AGE_MIN ?? 5);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000;
}

export function pickupRadiusKm() {
  const value = Number(process.env.COURIER_PICKUP_RADIUS_KM ?? 1.5);
  return Number.isFinite(value) && value > 0 ? value : 1.5;
}

export function assessLocationJump(input: {
  previousLat: number | null;
  previousLng: number | null;
  previousAt: Date | null;
  lat: number;
  lng: number;
  now?: number;
}) {
  if (
    input.previousLat == null ||
    input.previousLng == null ||
    !input.previousAt
  ) {
    return { suspicious: false as const, distanceKm: 0, speedKmh: 0 };
  }

  const now = input.now ?? Date.now();
  const elapsedHours = (now - input.previousAt.getTime()) / 3_600_000;
  const distanceKm = haversineKm(
    { lat: input.previousLat, lng: input.previousLng },
    { lat: input.lat, lng: input.lng },
  );

  if (elapsedHours <= 0) {
    return {
      suspicious: distanceKm > 0.5,
      distanceKm,
      speedKmh: Number.POSITIVE_INFINITY,
    };
  }

  const speedKmh = distanceKm / elapsedHours;
  const maxSpeed = Number(process.env.COURIER_MAX_SPEED_KMH ?? 180);
  const safeMax = Number.isFinite(maxSpeed) && maxSpeed > 0 ? maxSpeed : 180;

  return {
    suspicious: distanceKm > 1 && speedKmh > safeMax,
    distanceKm,
    speedKmh,
  };
}
