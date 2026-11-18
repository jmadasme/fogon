import { isIP } from "node:net";

type Bucket = {
  count: number;
  resetAt: number;
};

const MAX_BUCKETS = 20_000;
const buckets = new Map<string, Bucket>();

function cleanup(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS) return;
  }

  // Si sigue creciendo, expulsa las entradas más antiguas (Map conserva orden).
  const excess = buckets.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) cleanup(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, retryAfter: 0 };
  }

  if (current.count >= limit) {
    return {
      ok: false as const,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  return {
    ok: true as const,
    remaining: limit - current.count,
    retryAfter: 0,
  };
}

function normalizeIp(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  // Soporta IPv4:puerto y [IPv6]:puerto.
  const first = raw.split(",")[0]?.trim() ?? "";
  const bracketed = first.startsWith("[")
    ? first.slice(1, first.indexOf("]") > 0 ? first.indexOf("]") : undefined)
    : null;
  if (bracketed && isIP(bracketed)) return bracketed;

  if (isIP(first)) return first;

  if (first.includes(".") && first.includes(":")) {
    const host = first.slice(0, first.lastIndexOf(":"));
    if (isIP(host)) return host;
  }

  return null;
}

export function getClientIpFromHeaders(headers: Headers) {
  // Solo confiar en cabeceras de proxy cuando la app está detrás de un proxy
  // conocido (Cloudflare/Nginx/Vercel). Si no, un atacante podría falsificar
  // X-Forwarded-For/X-Real-IP y saltarse el rate limit.
  if (process.env.TRUST_PROXY === "1") {
    const cloudflare = normalizeIp(headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;

    // El proxy debe sobrescribir X-Forwarded-For. El primer valor es el
    // cliente original; el resto son proxies intermedios.
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      for (const part of forwarded.split(",")) {
        const candidate = normalizeIp(part);
        if (candidate) return candidate;
      }
    }

    const real = normalizeIp(headers.get("x-real-ip"));
    if (real) return real;
  }

  // Sin un proxy confiable no hay una IP de conexión fiable en Next.
  // Devolver una constante evita que un header arbitrario cree buckets nuevos.
  return "local";
}

export function getClientIp(request: Request) {
  return getClientIpFromHeaders(request.headers);
}
