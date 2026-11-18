import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmFlowPayment, signFlowParams } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  BodyTooLargeError,
  readFormBody,
  SMALL_JSON_BODY_LIMIT,
} from "@/lib/request";

function ok() {
  // Flow espera HTTP 200 para dar por aceptada la notificación.
  return new NextResponse("OK", { status: 200 });
}

function expectedCommerceOrder(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { commerceOrder?: string };
    return typeof parsed.commerceOrder === "string"
      ? parsed.commerceOrder
      : null;
  } catch {
    return null;
  }
}

function verifyFlowSignature(
  params: Record<string, string>,
  providedSignature: string | null,
) {
  const secretKey = process.env.FLOW_SECRET_KEY;
  if (!secretKey || !providedSignature) return false;

  const expected = signFlowParams(params, secretKey);

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  // Límite real de body por stream (protege contra Transfer-Encoding:
  // chunked, que no envía Content-Length).
  let form: FormData;
  try {
    form = await readFormBody(request, SMALL_JSON_BODY_LIMIT);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return new NextResponse("Payload demasiado grande.", { status: 413 });
    }
    return ok();
  }

  const token = String(form.get("token") ?? "");
  if (!token) return ok();

  // Flow puede enviar la firma HMAC junto con los parámetros. Si la envía,
  // la validamos de forma timing-safe. Si no, continuamos con las
  // validaciones compensatorias (token conocido, commerceOrder y monto).
  const signature = form.get("s");
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key !== "s") {
      params[key] = typeof value === "string" ? value : value.name;
    }
  }
  const hasValidSignature =
    typeof signature === "string" && verifyFlowSignature(params, signature);
  if (typeof signature === "string" && signature && !hasValidSignature) {
    console.warn("Flow confirm: firma HMAC inválida");
    return new NextResponse("Unauthorized.", { status: 401 });
  }

  // Rate limit por IP solo para peticiones sin firma válida: las
  // notificaciones legítimas de Flow (firmadas) no consumen el bucket,
  // por lo que un atacante no puede desplazar las confirmaciones reales.
  if (!hasValidSignature) {
    const ip = getClientIp(request);
    const limit = rateLimit(`flow-confirm:${ip}`, 30, 60_000);
    if (!limit.ok) {
      return new NextResponse("Too many requests.", {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      });
    }
  }

  const order = await db.order.findFirst({
    where: { paymentProvider: "FLOW", paymentRef: token },
    include: { payment: true },
  });

  if (!order) {
    console.warn("Flow confirm: token desconocido", { token: token.slice(0, 8) });
    return ok();
  }

  // Rate limit por token para dificultar fuerza bruta de tokens válidos.
  const tokenLimit = rateLimit(`flow-confirm:token:${token}`, 10, 60_000);
  if (!tokenLimit.ok) {
    return new NextResponse("Too many requests.", {
      status: 429,
      headers: { "Retry-After": String(tokenLimit.retryAfter) },
    });
  }

  try {
    const result = await confirmFlowPayment(token);
    const expected = expectedCommerceOrder(order.payment?.raw);

    if (
      expected &&
      result.commerceOrder &&
      result.commerceOrder !== expected
    ) {
      console.error("Flow confirm: commerceOrder no coincide", {
        orderId: order.id,
      });
      return ok();
    }

    if (result.status === "paid") {
      if (
        Math.round(result.amount) !== order.total ||
        (result.currency && result.currency !== "CLP")
      ) {
        console.error("Flow confirm: monto/moneda no coincide", {
          orderId: order.id,
          expected: order.total,
          received: result.amount,
          currency: result.currency,
        });
        await db.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_MISMATCH",
            payload: JSON.stringify({
              provider: "FLOW",
              expectedAmount: order.total,
              receivedAmount: result.amount,
              currency: result.currency,
            }),
          },
        });
        return ok();
      }

      await markOrderPaid({
        orderId: order.id,
        provider: "FLOW",
        providerRef: token,
        raw: result.raw,
      });
    } else if (["rejected", "cancelled"].includes(result.status)) {
      await markPaymentFailed({
        orderId: order.id,
        provider: "FLOW",
        providerRef: token,
        raw: result.raw,
      });
    }

    return ok();
  } catch (error) {
    console.error("Flow confirm error", error);
    // 500 para que Flow reintente la notificación.
    return new NextResponse("Retry", { status: 500 });
  }
}
