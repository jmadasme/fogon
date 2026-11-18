import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado.");
  return new TextEncoder().encode(secret);
}

export async function createMobileToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    mobile: true,
    ver: user.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("fogon")
    .setAudience("fogon-mobile")
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getMobileSession(
  request: Request,
): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  try {
    const { payload } = await jwtVerify(header.slice(7), getSecret(), {
      issuer: "fogon",
      audience: "fogon-mobile",
    });
    if (!payload.sub) return null;

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });
    if (!user || user.status !== "ACTIVE") return null;
    if (typeof payload.ver !== "number" || payload.ver !== user.tokenVersion) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  } catch {
    return null;
  }
}

export async function getRequestSession(request: Request) {
  return (await getMobileSession(request)) ?? (await getSession());
}
