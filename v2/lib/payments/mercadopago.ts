/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import crypto from "node:crypto";
import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";
import {
  appUrl,
  PaymentConfigError,
  type PaymentInitResult,
  type PaymentOrder,
  paymentMode,
} from "./types";

function getAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new PaymentConfigError(
      "Mercado Pago no está configurado. Falta MERCADOPAGO_ACCESS_TOKEN.",
    );
  }
  if (paymentMode() === "production" && token.startsWith("TEST-")) {
    throw new PaymentConfigError(
      "Mercado Pago está usando un access token de prueba en producción.",
    );
  }
  return token;
}

function getClient() {
  return new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 10000 },
  });
}

export async function createMercadoPagoPreference(
  order: PaymentOrder,
): Promise<PaymentInitResult> {
  if (paymentMode() === "mock") {
    return { provider: "MOCK", status: "PAID", providerRef: `mock_${order.id}` };
  }

  const client = getClient();
  const preference = new Preference(client);
  const base = appUrl();

  const response: any = await preference.create({
    body: {
      items: [
        {
          id: order.code,
          title: `Pedido ${order.code} · ${order.storeName}`,
          description: "Pedido de comida Fogón",
          quantity: 1,
          unit_price: order.total,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: order.customerName,
        email: order.customerEmail,
      },
      external_reference: order.id,
      statement_descriptor: "FOGON",
      notification_url: `${base}/api/payments/webhook/mercadopago`,
      back_urls: {
        success: `${base}/api/payments/mercadopago/return?orderId=${order.id}`,
        failure: `${base}/api/payments/mercadopago/return?orderId=${order.id}`,
        pending: `${base}/api/payments/mercadopago/return?orderId=${order.id}`,
      },
      auto_return: "approved",
      payment_methods: {
        installments: 1,
      },
    },
  });

  return {
    provider: "MERCADOPAGO",
    status: "PENDING",
    providerRef: response.id,
    redirectUrl: response.init_point ?? response.sandbox_init_point,
    raw: JSON.stringify(response),
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const client = getClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

export async function refundMercadoPagoPayment(paymentId: string) {
  const client = getClient();
  const refund = new PaymentRefund(client);
  return refund.total({ payment_id: paymentId });
}

export function verifyMercadoPagoSignature(headers: Headers, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const signature = headers.get("x-signature");
  const requestId = headers.get("x-request-id");
  if (!signature || !requestId) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.trim().split("=");
      return [key, value];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return false;
  // Ventana de ±600 s (recomendación de Mercado Pago; antes ±3600 s,
  // docs/30 BAJA-2): una notificación firmada capturada no puede
  // reenviarse hasta una hora después.
  if (Math.abs(Date.now() / 1000 - timestamp) > 60 * 10) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(v1, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
