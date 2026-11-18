import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const limit = rateLimit(`mobile-me:${session.id}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  return NextResponse.json({ user: session });
}
