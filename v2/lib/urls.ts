export function safeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const TRUSTED_PAYMENT_HOSTS: Record<string, Set<string>> = {
  FLOW: new Set(["sandbox.flow.cl", "www.flow.cl"]),
  MERCADOPAGO: new Set([
    "www.mercadopago.cl",
    "www.mercadopago.com",
    "www.mercadolibre.com",
    "sandbox.mercadopago.com",
  ]),
  TRANSBANK: new Set([
    "webpay3g.transbank.cl",
    "webpay3gint.transbank.cl",
    "webpay.transbank.cl",
  ]),
};

export function isTrustedPaymentRedirectUrl(
  value: string,
  provider?: string,
): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;

    const hosts = provider
      ? TRUSTED_PAYMENT_HOSTS[provider]
      : new Set(Object.values(TRUSTED_PAYMENT_HOSTS).flatMap((s) => [...s]));
    if (!hosts) return false;
    return [...hosts].some(
      (host) => url.host === host || url.host.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
