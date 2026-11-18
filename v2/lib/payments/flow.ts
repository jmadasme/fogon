/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import crypto from "node:crypto";
import {
  appUrl,
  PaymentConfigError,
  type PaymentInitResult,
  type PaymentOrder,
  paymentMode,
} from "./types";

const FLOW_BASE = {
  sandbox: "https://sandbox.flow.cl/api",
  production: "https://www.flow.cl/api",
} as const;

function flowConfig() {
  const environment =
    process.env.FLOW_ENVIRONMENT === "production" ? "production" : "sandbox";
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new PaymentConfigError(
      "Flow no está configurado. Faltan FLOW_API_KEY y FLOW_SECRET_KEY.",
    );
  }

  if (paymentMode() === "production" && environment !== "production") {
    throw new PaymentConfigError(
      "Flow está en sandbox dentro de producción. Configura FLOW_ENVIRONMENT=production.",
    );
  }

  return { baseUrl: FLOW_BASE[environment], apiKey, secretKey };
}

/**
 * Flow firma todos los parámetros menos `s`: se ordenan por nombre, se
 * concatenan como `nombre + valor` y se aplica HMAC-SHA256 con la secretKey.
 */
export function signFlowParams(
  params: Record<string, string | number>,
  secretKey: string,
) {
  const toSign = Object.keys(params)
    .filter((key) => key !== "s")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

async function flowRequest(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number>,
) {
  const { baseUrl, apiKey, secretKey } = flowConfig();
  const payload: Record<string, string | number> = { ...params, apiKey };
  payload.s = signFlowParams(payload, secretKey);

  const encoded = new URLSearchParams(
    Object.entries(payload).map(([key, value]) => [key, String(value)]),
  );

  const response = await fetch(
    method === "GET" ? `${baseUrl}${path}?${encoded}` : `${baseUrl}${path}`,
    {
      method,
      ...(method === "POST"
        ? {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: encoded,
          }
        : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.message ??
        data?.error ??
        `Flow respondió HTTP ${response.status}.`,
    );
  }

  return data;
}

export async function createFlowPayment(
  order: PaymentOrder,
): Promise<PaymentInitResult> {
  if (paymentMode() === "mock") {
    return {
      provider: "MOCK",
      status: "PAID",
      providerRef: `mock_${order.id}`,
      raw: JSON.stringify({ mode: "mock" }),
    };
  }

  const base = appUrl();
  // Flow exige un commerceOrder distinto por intento. El token se guarda en
  // Order.paymentRef para poder conciliar con getStatus.
  const commerceOrder = `${order.code}-${Date.now().toString(36)}`;
  const paymentMethod =
    order.flowMethod === "webpay"
      ? process.env.FLOW_PAYMENT_METHOD_WEBPAY || "1"
      : order.flowMethod === "mach"
        ? process.env.FLOW_PAYMENT_METHOD_MACH || "2"
        : process.env.FLOW_PAYMENT_METHOD;
  const timeout = process.env.FLOW_TIMEOUT_SECONDS;

  const data: any = await flowRequest("POST", "/payment/create", {
    commerceOrder,
    subject: `Pedido ${order.code} · ${order.storeName}`.slice(0, 255),
    currency: "CLP",
    amount: order.total,
    email: order.customerEmail,
    urlConfirmation: `${base}/api/payments/flow/confirm`,
    urlReturn: `${base}/api/payments/flow/return`,
    optional: JSON.stringify({ orderId: order.id, code: order.code }),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(timeout ? { timeout } : {}),
  });

  if (!data?.url || !data?.token) {
    throw new Error("Flow no devolvió la URL y el token de pago.");
  }

  const checkoutUrl = `${data.url}?token=${encodeURIComponent(data.token)}`;

  return {
    provider: "FLOW",
    status: "PENDING",
    providerRef: data.token,
    redirectUrl: checkoutUrl,
    raw: JSON.stringify({
      commerceOrder,
      flowOrder: data.flowOrder,
      checkoutUrl,
      flowMethod: order.flowMethod ?? null,
      paymentMethod: paymentMethod || null,
    }),
  };
}

export async function getFlowPaymentStatus(token: string) {
  return flowRequest("GET", "/payment/getStatus", { token });
}

export async function confirmFlowPayment(token: string) {
  const data: any = await getFlowPaymentStatus(token);
  const status = Number(data?.status);

  return {
    status:
      status === 2
        ? "paid"
        : status === 3
          ? "rejected"
          : status === 4
            ? "cancelled"
            : "pending",
    commerceOrder: String(data?.commerceOrder ?? ""),
    amount: Number(data?.amount ?? 0),
    currency: String(data?.currency ?? ""),
    flowOrder: Number(data?.flowOrder ?? 0),
    media: data?.paymentData?.media ?? data?.pending_info?.media ?? null,
    pendingInfo: data?.pending_info ?? null,
    raw: JSON.stringify(data),
  };
}

export async function refundFlowPayment(input: {
  commerceOrder: string;
  amount: number;
  email: string;
}) {
  return flowRequest("POST", "/refund/create", {
    refundCommerceOrder: `${input.commerceOrder}-R-${Date.now().toString(36)}`,
    receiverEmail: input.email,
    amount: input.amount,
    urlCallBack: `${appUrl()}/api/payments/flow/refund`,
    commerceTrxId: input.commerceOrder,
  });
}

export async function getFlowRefundStatus(token: string) {
  return flowRequest("GET", "/refund/getStatus", { token });
}
