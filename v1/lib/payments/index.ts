/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  refundMercadoPagoPayment,
} from "./mercadopago";
import {
  commitTransbankTransaction,
  createTransbankTransaction,
  refundTransbankTransaction,
} from "./transbank";
import {
  type PaymentInitResult,
  type PaymentOrder,
  type PaymentProvider,
  paymentMode,
} from "./types";

export async function createPayment(
  order: PaymentOrder,
  provider: PaymentProvider,
): Promise<PaymentInitResult> {
  if (paymentMode() === "mock" && process.env.NODE_ENV === "production") {
    throw new Error("Pagos en modo mock no permitidos en producción.");
  }

  if (provider === "CASH") {
    return { provider: "CASH", status: "PENDING" };
  }

  if (paymentMode() === "mock") {
    return {
      provider: "MOCK",
      status: "PAID",
      providerRef: `mock_${order.id}`,
      raw: JSON.stringify({ mode: "mock" }),
    };
  }

  if (provider === "MERCADOPAGO") {
    return createMercadoPagoPreference(order);
  }

  if (provider === "TRANSBANK") {
    return createTransbankTransaction(order);
  }

  throw new Error("Proveedor de pago no soportado");
}

export async function confirmMercadoPagoPayment(paymentId: string) {
  const payment: any = await getMercadoPagoPayment(paymentId);
  const orderId = String(payment.external_reference ?? "");
  const status = String(payment.status ?? "unknown");
  return {
    orderId,
    status,
    providerRef: String(payment.id ?? paymentId),
    amount: Number(payment.transaction_amount ?? 0),
    currency: String(payment.currency_id ?? ""),
    raw: JSON.stringify({
      status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id,
    }),
  };
}

export async function confirmTransbankPayment(orderId: string, token: string) {
  const response: any = await commitTransbankTransaction(token);
  const status = response?.status === "AUTHORIZED" ? "approved" : "rejected";
  return {
    orderId,
    status,
    providerRef: token,
    buyOrder: String(response?.buy_order ?? ""),
    amount: Number(response?.amount ?? 0),
    raw: JSON.stringify({
      status: response?.status,
      response_code: response?.response_code,
      authorization_code: response?.authorization_code,
      amount: response?.amount,
      buy_order: response?.buy_order,
    }),
  };
}

export async function refundPayment(
  provider: string,
  providerRef: string | null | undefined,
  amount: number,
) {
  if (provider === "MERCADOPAGO") {
    if (!providerRef) throw new Error("Falta la referencia del pago de Mercado Pago.");
    return refundMercadoPagoPayment(providerRef);
  }
  if (provider === "TRANSBANK") {
    if (!providerRef) throw new Error("Falta el token de Transbank.");
    return refundTransbankTransaction(providerRef, amount);
  }
  // Efectivo y mock se gestionan manualmente/desde el panel.
  return { ok: true, manual: true };
}

export { refundTransbankTransaction };
