import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getMerchantOrders } from "@/lib/merchant/orders";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "MERCHANT" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (process.env.MFA_ENFORCED === "true" && !session.mfaEnabled) {
    return NextResponse.json(
      { error: "Completa la configuración de MFA para continuar." },
      { status: 403 },
    );
  }
  // El tablero del local refresca cada 5 s (12/min); 60/min deja holgura.
  const limit = rateLimit(`merchant-orders:${session.id}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const merchant = await db.merchant.findUnique({
    where: { ownerId: session.id },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
  }

  const orders = await getMerchantOrders(merchant.id);
  return NextResponse.json({ orders });
}
