import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "COURIER") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const limit = rateLimit(`mobile-earnings:${session.id}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const courier = await db.courier.findUnique({
    where: { userId: session.id },
    select: { id: true, verificationStatus: true },
  });
  if (!courier) {
    return NextResponse.json({ error: "Repartidor no encontrado." }, { status: 404 });
  }
  if (courier.verificationStatus !== "VERIFIED") {
    return NextResponse.json(
      { error: "Tu cuenta de repartidor aún no está verificada." },
      { status: 403 },
    );
  }

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const orders = await db.order.findMany({
    where: {
      courierId: courier.id,
      status: "DELIVERED",
      deliveredAt: { gte: since },
    },
    include: { store: { select: { name: true, emoji: true, comuna: true } } },
    orderBy: { deliveredAt: "desc" },
    take: 200,
  });

  const base = orders.reduce((sum, order) => sum + order.courierPayout, 0);
  const tips = orders.reduce((sum, order) => sum + order.tip, 0);

  return NextResponse.json({
    summary: {
      total: base + tips,
      base,
      tips,
      deliveries: orders.length,
      average: orders.length ? Math.round((base + tips) / orders.length) : 0,
    },
    orders: orders.map((order) => ({
      id: order.id,
      code: order.code,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      courierPayout: order.courierPayout,
      tip: order.tip,
      total: order.courierPayout + order.tip,
      store: order.store,
    })),
  });
}
