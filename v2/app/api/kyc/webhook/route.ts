import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyDiditDecision } from "@/lib/kyc";
import { BodyTooLargeError, readTextBody } from "@/lib/request";

function eventDate(body: Record<string, unknown>) {
  const raw = body.created_at ?? body.timestamp;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw > 1e12 ? raw : raw * 1000);
  }
  if (typeof raw === "string") {
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      return new Date(numeric > 1e12 ? numeric : numeric * 1000);
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function timingSafeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isValidDiditSignature(
  raw: string,
  body: unknown,
  headers: Headers,
) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;

  const timestamp = headers.get("x-timestamp");
  if (!timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const signatureV2 = headers.get("x-signature-v2");
  const signatureRaw = headers.get("x-signature");

  if (signatureV2) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(canonicalJson(body))
      .digest("hex");
    if (timingSafeEqual(expected, signatureV2)) return true;
  }
  if (signatureRaw) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    if (timingSafeEqual(expected, signatureRaw)) return true;
  }
  return false;
}

function genericSignature(headers: Headers, raw: string, secret: string) {
  const signature = headers.get("x-kyc-signature");
  const timestamp = headers.get("x-kyc-timestamp");
  if (!signature || !timestamp) return false;

  // Ventana de ±300 s: una notificación firmada capturada no puede
  // reenviarse horas o días después.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${raw}`)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await readTextBody(request, 256 * 1024);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
    }
    raw = "";
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const isDidit =
    request.headers.has("x-signature-v2") ||
    request.headers.has("x-signature") ||
    typeof body.session_id === "string";

  if (isDidit) {
    if (!isValidDiditSignature(raw, body, request.headers)) {
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }

    const sessionId =
      typeof body.session_id === "string" ? body.session_id : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!sessionId || !status) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    const record = await applyDiditDecision({
      sessionId,
      status,
      decision: body.decision,
      eventAt: eventDate(body),
    });
    if (!record) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    return NextResponse.json({ ok: true });
  }

  // Formato genérico para un proveedor externo que use KYC_HOSTED_URL.
  // Contrato de firma: HMAC-SHA256 de "<ts>.<rawBody>" con
  // KYC_WEBHOOK_SECRET, enviado en "x-kyc-signature", con el timestamp
  // (segundos UNIX) en "x-kyc-timestamp". La ventana es de ±300 s y el
  // cuerpo debe traer created_at/timestamp para ordenar eventos: sin
  // esto, un webhook capturado podía reenviarse indefinidamente y un
  // evento viejo pisaba uno nuevo (docs/30, MEDIA-03).
  const secret = process.env.KYC_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "KYC_WEBHOOK_SECRET no está configurado." },
      { status: 503 },
    );
  }
  if (!genericSignature(request.headers, raw, secret)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  const caseId = String(body.caseId ?? "");
  const status = String(body.status ?? "");
  if (!caseId || !["APPROVED", "REJECTED", "PENDING"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const record = await db.kycCase.findUnique({ where: { id: caseId } });
  if (!record) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  // Guard de orden: un evento más viejo que el último aplicado no pisa
  // la decisión actual (replay de una notificación capturada).
  const eventAt = eventDate(body) ?? new Date();
  if (
    record.providerEventAt &&
    eventAt.getTime() < record.providerEventAt.getTime()
  ) {
    return NextResponse.json({ ok: true, stale: true });
  }

  await db.kycCase.update({
    where: { id: caseId },
    data: {
      status,
      livenessScore:
        typeof body.livenessScore === "number" ? body.livenessScore : null,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 240) : null,
      providerEventAt: eventAt,
      reviewedAt: new Date(),
    },
  });
  await db.auditLog.create({
    data: {
      action: `kyc.provider.${status.toLowerCase()}`,
      entity: "KycCase",
      entityId: caseId,
      before: JSON.stringify({ status: record.status }),
      after: JSON.stringify({ status, reason: body.reason ?? null }),
    },
  });

  return NextResponse.json({ ok: true });
}
