import "server-only";

import { db } from "@/lib/db";

export type KycRole = "MERCHANT" | "COURIER";

const DIDIT_BASE = "https://verification.didit.me";

export function kycRequired() {
  return process.env.KYC_REQUIRED === "true";
}

export function kycProvider() {
  return process.env.KYC_PROVIDER ?? "mock";
}

export async function getKycCase(userId: string, role: KycRole) {
  return db.kycCase.findFirst({
    where: { userId, role },
    orderBy: { createdAt: "desc" },
  });
}

function appBase() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function diditCallback() {
  const configured = process.env.DIDIT_CALLBACK_URL?.trim();
  return configured ? configured : `${appBase()}/kyc/return`;
}

async function diditFetch(path: string, init: RequestInit = {}) {
  const key = process.env.DIDIT_API_KEY;
  if (!key) {
    throw new Error("DIDIT_API_KEY no está configurado.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${DIDIT_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      throw new Error(
        `Didit respondió ${response.status}: ${
          typeof data?.detail === "string" ? data.detail : "error"
        }`,
      );
    }
    return data ?? {};
  } finally {
    clearTimeout(timer);
  }
}

export function mapDiditStatus(status: string): {
  status: "APPROVED" | "REJECTED" | "PENDING";
  reason?: string;
} {
  if (status === "Approved") return { status: "APPROVED" };
  if (status === "Declined") {
    return { status: "REJECTED", reason: "Didit: verificación rechazada." };
  }
  if (status === "In Review") {
    return {
      status: "PENDING",
      reason: "Didit: en revisión manual.",
    };
  }
  if (["Expired", "Abandoned", "Kyc Expired"].includes(status)) {
    return {
      status: "REJECTED",
      reason: `Didit: sesión ${status.toLowerCase()}.`,
    };
  }
  return { status: "PENDING", reason: `Didit: ${status}.` };
}

function livenessFromDecision(decision: unknown) {
  if (!decision || typeof decision !== "object") return null;
  const checks = (decision as { liveness_checks?: unknown }).liveness_checks;
  if (!Array.isArray(checks)) return null;
  const score = checks.find(
    (check): check is { score: number } =>
      Boolean(check) &&
      typeof check === "object" &&
      typeof (check as { score?: unknown }).score === "number",
  );
  return score?.score ?? null;
}

export async function applyDiditDecision(input: {
  sessionId: string;
  status?: string;
  decision?: unknown;
  caseId?: string;
  eventAt?: Date;
}) {
  let record = input.caseId
    ? await db.kycCase.findUnique({ where: { id: input.caseId } })
    : await db.kycCase.findFirst({
        where: { provider: "didit", providerRef: input.sessionId },
      });
  if (
    !record ||
    record.provider !== "didit" ||
    record.providerRef !== input.sessionId
  ) {
    return null;
  }

  // La entrega de webhooks no está garantizada en orden. Un evento viejo
  // (por ejemplo un Approved reenviado) no debe pisar un Declined más nuevo.
  if (
    input.eventAt &&
    record.providerEventAt &&
    input.eventAt.getTime() < record.providerEventAt.getTime()
  ) {
    return record;
  }

  const status = input.status ?? "In Progress";
  const mapped = mapDiditStatus(status);
  const livenessScore = livenessFromDecision(input.decision);
  const wasApproved = record.status === "APPROVED";
  if (
    record.status === mapped.status &&
    record.reason === (mapped.reason ?? null) &&
    record.livenessScore === livenessScore
  ) {
    if (
      input.eventAt &&
      (!record.providerEventAt ||
        input.eventAt.getTime() > record.providerEventAt.getTime())
    ) {
      record = await db.kycCase.update({
        where: { id: record.id },
        data: { providerEventAt: input.eventAt },
      });
    }
    return record;
  }

  record = await db.kycCase.update({
    where: { id: record.id },
    data: {
      status: mapped.status,
      reason: mapped.reason ?? null,
      livenessScore,
      providerEventAt: input.eventAt ?? record.providerEventAt,
      providerUrl: mapped.status === "PENDING" ? record.providerUrl : null,
      reviewedAt: mapped.status === "PENDING" ? null : new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      action: `kyc.didit.${status.toLowerCase().replaceAll(" ", "_")}`,
      entity: "KycCase",
      entityId: record.id,
      after: JSON.stringify({
        status: mapped.status,
        diditStatus: status,
        livenessScore,
      }),
    },
  });

  // Si un KYC ya aprobado deja de serlo (documento vencido, revocación o
  // rechazo posterior), se retira la verificación y se fuerza re-login.
  if (wasApproved && mapped.status === "REJECTED") {
    const user = await db.user.findUnique({
      where: { id: record.userId },
      select: { role: true },
    });
    if (user?.role === "COURIER") {
      await db.courier.updateMany({
        where: { userId: record.userId },
        data: { verificationStatus: "PENDING", status: "OFFLINE" },
      });
    }
    if (user?.role === "MERCHANT") {
      const merchant = await db.merchant.findUnique({
        where: { ownerId: record.userId },
        select: { id: true },
      });
      if (merchant) {
        await db.merchant.update({
          where: { id: merchant.id },
          data: { status: "PENDING" },
        });
        await db.store.updateMany({
          where: { merchantId: merchant.id },
          data: { status: "PENDING" },
        });
      }
    }
    await db.user.update({
      where: { id: record.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await db.auditLog.create({
      data: {
        action: "kyc.revoked",
        entity: "KycCase",
        entityId: record.id,
        after: JSON.stringify({ role: user?.role, diditStatus: status }),
      },
    });
  }

  return record;
}

export async function refreshKycFromProvider(
  sessionId: string,
  userId?: string,
) {
  if (!sessionId || sessionId.length > 200) return null;

  // Sin userId solo lo usa el webhook (firma HMAC). Con userId, el caso debe
  // pertenecer a esa cuenta: evita que un usuario refresque el KYC de otro.
  const owned = await db.kycCase.findFirst({
    where: {
      provider: "didit",
      providerRef: sessionId,
      ...(userId ? { userId } : {}),
    },
    select: { id: true, status: true },
  });
  if (!owned) return null;

  if (owned.status === "APPROVED" || owned.status === "REJECTED") {
    return db.kycCase.findUnique({ where: { id: owned.id } });
  }

  const decision = await diditFetch(
    `/v3/session/${encodeURIComponent(sessionId)}/decision/`,
  );
  return applyDiditDecision({
    sessionId,
    caseId: owned.id,
    // El polling obtuvo la decisión actual: fija un piso temporal para que un
    // webhook viejo reenviado no pueda pisarla.
    eventAt: new Date(),
    status: typeof decision.status === "string" ? decision.status : undefined,
    decision,
  });
}

export async function startKyc(
  user: { id: string; email: string; name: string },
  role: KycRole,
) {
  const provider = kycProvider();
  const existing = await getKycCase(user.id, role);
  if (existing?.status === "APPROVED") {
    return { record: existing, redirectUrl: null };
  }

  // Si ya hay una sesión de Didit reciente, no crear otra (costo y abuso).
  if (
    existing?.status === "PENDING" &&
    existing.providerRef &&
    existing.submittedAt &&
    Date.now() - existing.submittedAt.getTime() < 15 * 60 * 1000
  ) {
    return { record: existing, redirectUrl: existing.providerUrl ?? null };
  }

  const record = existing
    ? await db.kycCase.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          provider,
          providerRef: null,
          providerUrl: null,
          submittedAt: new Date(),
          reason: null,
          reviewedAt: null,
        },
      })
    : await db.kycCase.create({
        data: {
          userId: user.id,
          role,
          status: "PENDING",
          provider,
          submittedAt: new Date(),
        },
      });

  if (provider === "mock") {
    const updated = await db.kycCase.update({
      where: { id: record.id },
      data: {
        providerRef: `mock_${user.id}_${Date.now()}`,
      },
    });
    return { record: updated, redirectUrl: null };
  }

  if (provider === "didit") {
    const workflowId = process.env.DIDIT_WORKFLOW_ID;
    if (!workflowId) {
      throw new Error("DIDIT_WORKFLOW_ID no está configurado.");
    }
    const response = await diditFetch("/v3/session/", {
      method: "POST",
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: user.id,
        callback: diditCallback(),
        language: "es",
        metadata: { caseId: record.id, role },
      }),
    });

    const sessionId =
      typeof response.session_id === "string" ? response.session_id : null;
    const url = typeof response.url === "string" ? response.url : null;
    if (!sessionId || !url) {
      throw new Error("Didit no devolvió session_id/url.");
    }

    const updated = await db.kycCase.update({
      where: { id: record.id },
      data: { providerRef: sessionId, providerUrl: url },
    });
    return { record: updated, redirectUrl: url };
  }

  const template = process.env.KYC_HOSTED_URL;
  if (!template) {
    throw new Error(
      "Falta KYC_HOSTED_URL para redirigir al proveedor de verificación.",
    );
  }
  const redirectUrl = template
    .replaceAll("{userId}", encodeURIComponent(user.id))
    .replaceAll("{role}", encodeURIComponent(role))
    .replaceAll("{caseId}", encodeURIComponent(record.id))
    .replaceAll("{email}", encodeURIComponent(user.email));

  return { record, redirectUrl };
}

export async function isKycApproved(userId: string, role: KycRole) {
  if (!kycRequired()) return true;
  const approved = await db.kycCase.findFirst({
    where: { userId, role, status: "APPROVED" },
    select: { id: true },
  });
  return Boolean(approved);
}
