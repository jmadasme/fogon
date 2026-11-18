import "server-only";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify } from "otplib";

export const MFA_SETUP_SECRET_COOKIE = "fogon_mfa_setup_secret";
export const MFA_RECOVERY_COOKIE = "fogon_mfa_recovery";

function key() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error(
      "MFA_ENCRYPTION_KEY es obligatorio. Genera uno con: openssl rand -base64 32",
    );
  }
  return crypto.createHash("sha256").update(configured).digest();
}

export function createTotpSecret() {
  return generateSecret();
}

export function totpUri(secret: string, email: string) {
  return generateURI({
    issuer: "Fogón",
    label: email,
    secret,
  });
}

export async function verifyTotp(secret: string, token: string) {
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({ secret, token });
  return result.valid;
}

export function encryptMfaSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptMfaSecret(payload: string) {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivPart, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

export async function hashRecoveryCodes(codes: string[]) {
  const hashes = await Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  return JSON.stringify(hashes);
}

export async function consumeRecoveryCode(
  stored: string | null,
  code: string,
) {
  if (!stored) return { ok: false as const, remaining: "" };
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(stored);
  } catch {
    return { ok: false as const, remaining: stored };
  }
  const normalized = code.trim().toUpperCase();
  for (let index = 0; index < hashes.length; index += 1) {
    if (await bcrypt.compare(normalized, hashes[index])) {
      hashes.splice(index, 1);
      return { ok: true as const, remaining: JSON.stringify(hashes) };
    }
  }
  return { ok: false as const, remaining: stored };
}
