import "server-only";

export const JSON_BODY_LIMIT = 64 * 1024;
export const SMALL_JSON_BODY_LIMIT = 8 * 1024;
export const UPLOAD_BODY_LIMIT = 6 * 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("Cuerpo de la petición demasiado grande.");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Chequeo rápido basado en Content-Length. Se mantiene como capa temprana,
 * pero NO es suficiente por sí solo: una petición con Transfer-Encoding
 * chunked no envía Content-Length. Usar readJsonBody/readFormBody/
 * readTextBody, que imponen el tope real sobre el stream.
 */
export function exceedsBodyLimit(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

/**
 * Lee el body completo con un tope real de bytes, independiente de las
 * cabeceras del cliente. Cancela el stream y lanza BodyTooLargeError en
 * cuanto se supera el límite, para no bufferizar payloads gigantes en
 * memoria (protección contra Transfer-Encoding: chunked).
 */
export async function readBodyBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (exceedsBodyLimit(request, maxBytes)) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const bytes = await readBodyBytes(request, maxBytes);
  if (bytes.byteLength === 0) throw new SyntaxError("Cuerpo vacío.");
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function readTextBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const bytes = await readBodyBytes(request, maxBytes);
  return new TextDecoder().decode(bytes);
}

export async function readFormBody(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  const bytes = await readBodyBytes(request, maxBytes);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const rebuilt = new Request(request.url, {
    method: request.method,
    headers,
    body: new Blob([bytes]),
  });
  return rebuilt.formData();
}
