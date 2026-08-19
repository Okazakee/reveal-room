import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getClientIp, noStoreHeaders, readJsonBody } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateCreateBody } from "@/lib/api/validation";
import { RATE_LIMITS } from "@/lib/runtime/rate-limit";
import { getRateLimiter } from "@/lib/runtime/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rooms — create a room.
 * Rate-limited per IP (Redis-backed on Vercel); returns the code, the
 * one-time host token, and both paths. The plaintext host token exists only
 * in this response (RR-SEC-002).
 */
export async function POST(req: Request): Promise<Response> {
  return handleRoute(async () => {
    const ip = getClientIp(req);
    const limiter = getRateLimiter();
    if (
      !(await limiter.allow("create", ip, RATE_LIMITS.create.limit, RATE_LIMITS.create.windowMs))
    ) {
      throw apiError("RATE_LIMITED");
    }

    let body: unknown;
    try {
      body = await readJsonBody(req, 8 * 1024);
    } catch {
      throw apiError("INVALID_REQUEST");
    }
    const input = validateCreateBody(body);
    const { room, hostToken } = await createStore().create(input);

    return Response.json(
      {
        ok: true,
        data: {
          code: room.code,
          hostToken,
          playerPath: `/r/${room.code}`,
          hostPath: `/host/${room.code}`,
        },
      },
      { headers: noStoreHeaders() },
    );
  });
}
