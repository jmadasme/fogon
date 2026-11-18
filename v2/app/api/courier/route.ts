import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { getCourierDashboard } from "@/lib/courier/data";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session || session.role !== "COURIER") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  // La app del repartidor sondea este dashboard cada 5 s (12/min);
  // 120/min deja holgura sin permitir saturar la base de datos.
  const limit = rateLimit(`courier-dash:${session.id}`, 120, 60_000);
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
  const dashboard = await getCourierDashboard(courier.id);
  if (!dashboard) {
    return NextResponse.json({ error: "Repartidor no encontrado." }, { status: 404 });
  }
  return NextResponse.json(dashboard);
}
