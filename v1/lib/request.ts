export function exceedsBodyLimit(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

export const JSON_BODY_LIMIT = 64 * 1024;
export const SMALL_JSON_BODY_LIMIT = 8 * 1024;
export const UPLOAD_BODY_LIMIT = 6 * 1024 * 1024;
