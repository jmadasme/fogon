import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const merchant = await db.merchant.findUnique({
    where: { ownerId: session.id },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
  }

  const orders = await getMerchantOrders(merchant.id);
  return NextResponse.json({ orders });
}
