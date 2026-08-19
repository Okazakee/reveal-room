/**
 * Route-handler helpers: bearer extraction, client IP, JSON bodies.
 * No tokens are ever logged or placed in URLs (RR-SEC-007, RR-SEC-011).
 */

const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function getParticipantId(req: Request): string | null {
  return req.headers.get("x-participant-id");
}

/**
 * Lightweight IP extraction for rate limiting (RR-LIMIT-006): trusted proxy
 * headers when present, otherwise a fixed fallback key. Documented as abuse
 * resistance, not strong identity.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp !== null && realIp.length > 0) return realIp;
  return "unknown";
}

export async function readJsonBody(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader !== null && Number(lengthHeader) > maxBytes) {
    throw new Error("body_too_large");
  }
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("body_too_large");
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

export function noStoreHeaders(): Record<string, string> {
  return NO_STORE;
}
