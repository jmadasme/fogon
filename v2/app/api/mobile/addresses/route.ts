import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const limit = rateLimit(`mobile-addresses:${session.id}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const addresses = await db.address.findMany({
    where: { userId: session.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({
    addresses: addresses.map((address) => ({
      id: address.id,
      label: address.label,
      line1: address.line1,
      comuna: address.comuna,
      instructions: address.instructions,
      isDefault: address.isDefault,
    })),
  });
}
