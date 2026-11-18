import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const limit = rateLimit(`mobile-orders:${session.id}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const orders = await db.order.findMany({
    where: { customerId: session.id },
    include: {
      store: { select: { name: true, emoji: true, slug: true, comuna: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      deliveryMode: order.deliveryMode,
      store: order.store,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  });
}
