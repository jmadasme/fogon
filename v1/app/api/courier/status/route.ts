import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { exceedsBodyLimit, SMALL_JSON_BODY_LIMIT } from "@/lib/request";

const schema = z.object({
  status: z.enum(["AVAILABLE", "OFFLINE"]),
});

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session || session.role !== "COURIER") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limit = rateLimit(`courier-status:${session.id}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiados cambios de estado." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  if (exceedsBodyLimit(request, SMALL_JSON_BODY_LIMIT)) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const courier = await db.courier.findUnique({
    where: { userId: session.id },
  });
  if (!courier) {
    return NextResponse.json({ error: "Repartidor no encontrado." }, { status: 404 });
  }
  if (courier.verificationStatus !== "VERIFIED") {
    return NextResponse.json(
      { error: "Tu cuenta aún no está verificada." },
      { status: 403 },
    );
  }

  if (parsed.data.status === "OFFLINE" || parsed.data.status === "AVAILABLE") {
    const active = await db.order.count({
      where: {
        courierId: courier.id,
        status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
      },
    });
    if (active > 0) {
      return NextResponse.json(
        {
          error:
            "Termina tu entrega activa antes de cambiar tu disponibilidad.",
        },
        { status: 409 },
      );
    }
  }

  await db.courier.update({
    where: { id: courier.id },
    data: {
      status: parsed.data.status,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ status: parsed.data.status });
}
