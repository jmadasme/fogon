import "server-only";

export type PaymentProvider = "MERCADOPAGO" | "TRANSBANK" | "CASH" | "MOCK";

export type PaymentOrder = {
  id: string;
  code: string;
  total: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  storeName: string;
};

export type PaymentInitResult = {
  provider: PaymentProvider;
  status: "PENDING" | "PAID";
  providerRef?: string;
  redirectUrl?: string;
  raw?: string;
};

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

export function paymentMode() {
  return process.env.PAYMENTS_MODE ?? "mock";
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
