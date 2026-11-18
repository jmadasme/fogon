import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const addresses = await db.address.findMany({
    where: { userId: session.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
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
