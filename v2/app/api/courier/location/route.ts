import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { BodyTooLargeError, readJsonBody, SMALL_JSON_BODY_LIMIT } from "@/lib/request";
import {
  assessLocationJump,
  courierSecurityEnforced,
  outsideSantiago,
} from "@/lib/courier/security";

const schema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session || session.role !== "COURIER") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limit = rateLimit(`courier-location:${session.id}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas actualizaciones de ubicación." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, SMALL_JSON_BODY_LIMIT);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
    }
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ubicación inválida." }, { status: 400 });
  }

  const courier = await db.courier.findUnique({
    where: { userId: session.id },
    select: {
      id: true,
      verificationStatus: true,
      currentLat: true,
      currentLng: true,
      lastSeenAt: true,
    },
  });
  if (!courier) {
    return NextResponse.json(
      { error: "Repartidor no encontrado." },
      { status: 404 },
    );
  }
  if (courier.verificationStatus !== "VERIFIED") {
    return NextResponse.json(
      { error: "Tu cuenta de repartidor aún no está verificada." },
      { status: 403 },
    );
  }

  if (courierSecurityEnforced() && outsideSantiago(parsed.data.lat, parsed.data.lng)) {
    return NextResponse.json(
      { error: "La ubicación está fuera de la zona de operación." },
      { status: 422 },
    );
  }

  if (courierSecurityEnforced()) {
    const jump = assessLocationJump({
      previousLat: courier.currentLat,
      previousLng: courier.currentLng,
      previousAt: courier.lastSeenAt,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
    if (jump.suspicious) {
      await db.auditLog.create({
        data: {
          actorId: session.id,
          action: "courier.location.anomaly",
          entity: "Courier",
          entityId: courier.id,
          after: JSON.stringify({
            distanceKm: Number(jump.distanceKm.toFixed(2)),
            speedKmh: Number.isFinite(jump.speedKmh)
              ? Math.round(jump.speedKmh)
              : "infinite",
          }),
        },
      });
      return NextResponse.json(
        {
          error:
            "Detectamos un salto de ubicación incompatible. Revisa tu GPS y vuelve a conectarte.",
        },
        { status: 422 },
      );
    }
  }

  await db.courier.update({
    where: { id: courier.id },
    data: {
      currentLat: parsed.data.lat,
      currentLng: parsed.data.lng,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
