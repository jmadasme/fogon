/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import {
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  WebpayPlus,
} from "transbank-sdk";
import {
  appUrl,
  PaymentConfigError,
  type PaymentInitResult,
  type PaymentOrder,
  paymentMode,
} from "./types";

function getTransaction() {
  const environment = process.env.TRANSBANK_ENVIRONMENT ?? "integration";

  // Nunca usar las credenciales públicas de integración en producción.
  if (paymentMode() === "production" && environment !== "production") {
    throw new PaymentConfigError(
      "Transbank está en modo integración. Configura TRANSBANK_ENVIRONMENT=production y credenciales reales.",
    );
  }

  const commerceCode =
    process.env.TRANSBANK_COMMERCE_CODE ||
    IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = process.env.TRANSBANK_API_KEY || IntegrationApiKeys.WEBPAY;

  if (environment === "production") {
    if (!process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY) {
      throw new PaymentConfigError(
        "Transbank producción requiere TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY.",
      );
    }
    return WebpayPlus.Transaction.buildForProduction(commerceCode, apiKey);
  }

  return WebpayPlus.Transaction.buildForIntegration(commerceCode, apiKey);
}

export async function createTransbankTransaction(
  order: PaymentOrder,
): Promise<PaymentInitResult> {
  if (paymentMode() === "mock") {
    return { provider: "MOCK", status: "PAID", providerRef: `mock_${order.id}` };
  }

  const transaction = getTransaction();
  const returnUrl = `${appUrl()}/api/payments/transbank/return/${order.id}`;
  const response: any = await transaction.create(
    order.code,
    order.id,
    order.total,
    returnUrl,
  );

  return {
    provider: "TRANSBANK",
    status: "PENDING",
    providerRef: response.token,
    redirectUrl: response.url,
    raw: JSON.stringify({ url: response.url }),
  };
}

export async function commitTransbankTransaction(token: string) {
  const transaction = getTransaction();
  const response: any = await transaction.commit(token);
  return response;
}

export async function refundTransbankTransaction(token: string, amount: number) {
  const transaction = getTransaction();
  return transaction.refund(token, amount);
}
