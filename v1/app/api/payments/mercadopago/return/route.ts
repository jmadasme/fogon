import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const status = url.searchParams.get("status") ?? "return";

  const base =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL!
      : url.origin;
  if (!orderId) {
    return NextResponse.redirect(new URL("/orders", base));
  }

  return NextResponse.redirect(
    new URL(`/order/${orderId}?payment=${encodeURIComponent(status)}`, base),
  );
}
