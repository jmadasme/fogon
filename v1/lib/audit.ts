import crypto from "node:crypto";
import { db } from "@/lib/db";

function emailFingerprint(email: string) {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

export async function auditAuth(
  action:
    | "login_success"
    | "login_failed"
    | "logout"
    | "register"
    | "mfa_success"
    | "mfa_failed"
    | "mfa_enabled",
  input: {
    userId?: string | null;
    email?: string;
    ip?: string;
    detail?: string;
  },
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.userId ?? null,
        action,
        entity: "Auth",
        entityId: input.userId ?? emailFingerprint(input.email ?? "unknown"),
        after: input.detail ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // La auditoría nunca debe bloquear el login.
  }
}
