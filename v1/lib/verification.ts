import "server-only";

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashPhoneCode(value: string) {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "dev-only")
    .update(value)
    .digest("hex");
}

export async function startEmailVerification(user: {
  id: string;
  email: string;
  name: string;
}) {
  const raw = crypto.randomBytes(32).toString("base64url");
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hash(raw),
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const link = `${appBase()}/verify-email?token=${encodeURIComponent(raw)}`;
  const result = await sendEmail({
    to: user.email,
    subject: "Verifica tu email en Fogón",
    text: `Hola ${user.name},\n\nConfirma tu email en Fogón con este enlace:\n${link}\n\nEl enlace vence en 24 horas.`,
  });
  return result;
}

export async function verifyEmailToken(raw: string) {
  if (!raw || raw.length > 200) return false;
  const user = await db.user.findFirst({
    where: {
      emailVerificationToken: hash(raw),
      emailVerificationExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!user) return false;

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    },
  });
  return true;
}

export async function startPhoneVerification(user: {
  id: string;
  phone: string | null;
}) {
  if (!user.phone) {
    return { ok: false as const, error: "No tienes un teléfono registrado." };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await db.user.update({
    where: { id: user.id },
    data: {
      phoneVerificationCode: hashPhoneCode(code),
      phoneVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const result = await sendSms({
    to: user.phone,
    body: `Tu código de verificación de Fogón es ${code}. Vence en 10 minutos.`,
  });

  return {
    ok: true as const,
    devCode: result.dev && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function verifyPhoneCode(userId: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerificationCode: true,
      phoneVerificationExpiresAt: true,
    },
  });
  if (
    !user?.phoneVerificationCode ||
    !user.phoneVerificationExpiresAt ||
    user.phoneVerificationExpiresAt.getTime() < Date.now()
  ) {
    return false;
  }
  if (user.phoneVerificationCode !== hashPhoneCode(code)) return false;

  await db.user.update({
    where: { id: userId },
    data: {
      phoneVerifiedAt: new Date(),
      phoneVerificationCode: null,
      phoneVerificationExpiresAt: null,
    },
  });
  return true;
}
