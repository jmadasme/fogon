import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ROLE_HOME } from "@/lib/constants";
import { db } from "@/lib/db";

const COOKIE_NAME = "fogon_session";
const MFA_LOGIN_COOKIE = "fogon_mfa_login";
const MFA_SETUP_COOKIE = "fogon_mfa_setup";
const SESSION_DAYS = 7;
const MFA_MINUTES = 10;

export type MfaPurpose = "login" | "setup";
export type MfaPendingUser = SessionUser & { mfaEnabled: boolean };

// Hash de relleno para comparar incluso cuando el email no existe y evitar
// enumeración de cuentas por diferencias de tiempo.
export const DUMMY_PASSWORD_HASH =
  "$2b$10$f3wdsqAFPDFb7L4NCHSMxuMOzKZrePCv2Shl6uuNZtD51qOWTQc/G";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  tokenVersion?: number;
  mfaEnabled?: boolean;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    ver: user.tokenVersion ?? 0,
    purpose: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("fogon")
    .setAudience("fogon-web")
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

function pendingCookie(purpose: MfaPurpose) {
  return purpose === "login" ? MFA_LOGIN_COOKIE : MFA_SETUP_COOKIE;
}

export async function createMfaPending(
  userId: string,
  purpose: MfaPurpose,
  tokenVersion = 0,
) {
  const token = await new SignJWT({ purpose, ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("fogon")
    .setAudience("fogon-mfa")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MFA_MINUTES}m`)
    .sign(getSecret());

  const store = await cookies();
  store.set(pendingCookie(purpose), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * MFA_MINUTES,
  });
}

export async function getMfaPending(
  purpose: MfaPurpose,
): Promise<MfaPendingUser | null> {
  const store = await cookies();
  const token = store.get(pendingCookie(purpose))?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "fogon",
      audience: "fogon-mfa",
    });
    if (!payload.sub || payload.purpose !== purpose) return null;

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
        mfaEnabled: true,
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
      mfaEnabled: user.mfaEnabled,
    };
  } catch {
    return null;
  }
}

export async function clearMfaPending(purpose: MfaPurpose) {
  const store = await cookies();
  store.delete(pendingCookie(purpose));
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "fogon",
      audience: "fogon-web",
    });
    if (!payload.sub || payload.purpose !== "session") return null;

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
        mfaEnabled: true,
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
      mfaEnabled: user.mfaEnabled,
    };
  } catch {
    return null;
  }
});

export async function requireUser(nextPath?: string) {
  const user = await getSession();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath ?? "/")}`);
  }
  return user;
}

export async function requireRole(role: string, nextPath?: string) {
  const user = await requireUser(nextPath);
  if (user.role !== role && user.role !== "ADMIN") {
    redirect(ROLE_HOME[user.role] ?? "/");
  }
  return user;
}

export function homeForRole(role: string) {
  return ROLE_HOME[role] ?? "/";
}
