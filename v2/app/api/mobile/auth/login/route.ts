import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth";
import { createMobileToken } from "@/lib/mobile-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { auditAuth } from "@/lib/audit";
import { BodyTooLargeError, readJsonBody, SMALL_JSON_BODY_LIMIT } from "@/lib/request";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonBody(request, SMALL_JSON_BODY_LIMIT);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
    }
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const ip = getClientIp(request);
  const limit = rateLimit(
    `mobile-login:${ip}:${email}`,
    5,
    60_000,
  );
  const byEmail = rateLimit(`mobile-login-email:${email}`, 20, 60_000);
  const byIp = rateLimit(`mobile-login-ip:${ip}`, 30, 60_000);
  if (!limit.ok || !byEmail.ok || !byIp.ok) {
    const retryAfter = Math.max(
      limit.retryAfter,
      byEmail.retryAfter,
      byIp.retryAfter,
    );
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const user = await db.user.findUnique({ where: { email } });
  const validPassword = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !validPassword) {
    await auditAuth("login_failed", { email, ip });
    return NextResponse.json(
      { error: "Email o contraseña incorrectos." },
      { status: 401 },
    );
  }
  if (user.status !== "ACTIVE") {
    await auditAuth("login_failed", {
      userId: user.id,
      email,
      ip,
      detail: "suspended",
    });
    return NextResponse.json(
      { error: "Tu cuenta está suspendida." },
      { status: 403 },
    );
  }
  if (user.role !== "CUSTOMER" && user.role !== "COURIER") {
    await auditAuth("login_failed", {
      userId: user.id,
      email,
      ip,
      detail: "role_not_allowed_mobile",
    });
    return NextResponse.json(
      { error: "Esta app es para clientes y repartidores." },
      { status: 403 },
    );
  }

  // La app móvil todavía no tiene un desafío TOTP. No emitir un Bearer que
  // saltaría el MFA que protege la cuenta en la web.
  if (user.mfaEnabled) {
    await auditAuth("login_failed", {
      userId: user.id,
      email,
      ip,
      detail: "mfa_required_mobile",
    });
    return NextResponse.json(
      {
        error:
          "Tu cuenta tiene MFA activo. Ingresa desde la web de Fogón para completar la verificación.",
      },
      { status: 403 },
    );
  }

  await auditAuth("login_success", { userId: user.id, email, ip });

  const token = await createMobileToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
}
