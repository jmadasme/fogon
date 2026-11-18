import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";

export async function GET(request: Request) {
  const session = await getMobileSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
