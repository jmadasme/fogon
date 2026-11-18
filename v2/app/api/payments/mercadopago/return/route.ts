import { NextResponse } from "next/server";

const VALID_STATUSES = new Set([
  "success",
  "failure",
  "pending",
  "return",
]);

// Los IDs de pedido son cuids alfanuméricos. Sin esta validación,
// orderId=../admin normalizaba la redirección a /admin dentro del mismo
// origin (docs/30, BAJA-1).
const VALID_ORDER_ID = /^[A-Za-z0-9_-]{6,64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const rawStatus = url.searchParams.get("status") ?? "return";
  const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "return";

  const base =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL!
      : url.origin;
  if (!orderId || !VALID_ORDER_ID.test(orderId)) {
    return NextResponse.redirect(new URL("/orders", base));
  }

  return NextResponse.redirect(
    new URL(`/order/${orderId}?payment=${encodeURIComponent(status)}`, base),
  );
}
