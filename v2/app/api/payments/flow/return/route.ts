import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { confirmFlowPayment } from "@/lib/payments";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  BodyTooLargeError,
  readFormBody,
  SMALL_JSON_BODY_LIMIT,
} from "@/lib/request";

function redirectTo(request: Request, path: string) {
  const base =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL!
      : request.url;
  // 303 fuerza un GET después del POST de Flow.
  return NextResponse.redirect(new URL(path, base), 303);
}

async function handleReturn(request: Request) {
  let token = new URL(request.url).searchParams.get("token") ?? "";

  // Flow puede volver con GET ?token=... o con POST form token=...
  // El body se lee con tope real por stream (protege contra chunked).
  if (!token && request.method === "POST") {
    try {
      const form = await readFormBody(request, SMALL_JSON_BODY_LIMIT);
      token = String(form.get("token") ?? "");
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return redirectTo(request, "/orders?payment=error");
      }
      token = "";
    }
  }

  if (!token) return redirectTo(request, "/orders?payment=error");

  // Rate limit por token e IP: el retorno legítimo del navegador son 1-2
  // peticiones; un bucle infinito con un token válido no debe poder
  // disparar llamadas ilimitadas a la API de Flow.
  const ip = getClientIp(request);
  const byToken = rateLimit(`flow-return:token:${token}`, 10, 60_000);
  const byIp = rateLimit(`flow-return:${ip}`, 60, 60_000);
  if (!byToken.ok || !byIp.ok) {
    const retryAfter = Math.max(byToken.retryAfter, byIp.retryAfter);
    return new NextResponse("Too many requests.", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  const order = await db.order.findFirst({
    where: { paymentProvider: "FLOW", paymentRef: token },
  });

  if (!order) return redirectTo(request, "/orders?payment=error");
  if (order.paymentStatus === "PAID") {
    return redirectTo(request, `/order/${order.id}?payment=success`);
  }

  try {
    const result = await confirmFlowPayment(token);

    if (result.status === "paid") {
      if (Math.round(result.amount) !== order.total) {
        console.error("Flow return: monto no coincide", {
          orderId: order.id,
          expected: order.total,
          received: result.amount,
        });
        await db.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_MISMATCH",
            payload: JSON.stringify({
              provider: "FLOW",
              expectedAmount: order.total,
              receivedAmount: result.amount,
            }),
          },
        });
        return redirectTo(request, `/order/${order.id}?payment=error`);
      }

      await markOrderPaid({
        orderId: order.id,
        provider: "FLOW",
        providerRef: token,
        raw: result.raw,
      });
      return redirectTo(request, `/order/${order.id}?payment=success`);
    }

    if (["rejected", "cancelled"].includes(result.status)) {
      await markPaymentFailed({
        orderId: order.id,
        provider: "FLOW",
        providerRef: token,
        raw: result.raw,
      });
      return redirectTo(request, `/order/${order.id}?payment=failed`);
    }

    return redirectTo(request, `/order/${order.id}?payment=pending`);
  } catch (error) {
    console.error("Flow return error", error);
    return redirectTo(request, `/order/${order.id}?payment=error`);
  }
}

export async function GET(request: Request) {
  return handleReturn(request);
}

export async function POST(request: Request) {
  return handleReturn(request);
}
