import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-auth";
import { auditAuth } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await getMobileSession(request);
  if (session) {
    await db.user.update({
      where: { id: session.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await auditAuth("logout", {
      userId: session.id,
      email: session.email,
      ip: getClientIp(request),
    });
  }
  return NextResponse.json({ ok: true });
}
