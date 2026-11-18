// Whitelist de hosts de pasarelas de pago. Antes de abrir cualquier
// redirectUrl devuelta por el backend se valida contra esta lista: en
// React Native, Linking.openURL acepta cualquier esquema (https
// arbitrario, intent://, deeplinks de otras apps), por lo que una
// respuesta manipulada podría abrir phishing o apps arbitrarias en el
// paso de mayor confianza para el usuario (docs/30, MEDIA-04).
const TRUSTED_PAYMENT_HOSTS: Record<string, string[]> = {
  FLOW: ["sandbox.flow.cl", "www.flow.cl"],
  MERCADOPAGO: [
    "www.mercadopago.cl",
    "www.mercadopago.com",
    "www.mercadolibre.com",
    "sandbox.mercadopago.com",
  ],
  TRANSBANK: [
    "webpay3g.transbank.cl",
    "webpay3gint.transbank.cl",
    "webpay.transbank.cl",
  ],
};

const ALL_HOSTS = Object.values(TRUSTED_PAYMENT_HOSTS).flat();

export function isTrustedPaymentRedirectUrl(
  value: string,
  provider?: string | null,
): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    // Solo http(s): bloquea intent://, fogon://, javascript:, etc.
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;

    const hosts = provider
      ? TRUSTED_PAYMENT_HOSTS[provider] ?? []
      : ALL_HOSTS;
    return hosts.some(
      (host) => url.host === host || url.host.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
