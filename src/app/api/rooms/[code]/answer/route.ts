import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, getParticipantId, noStoreHeaders, readJsonBody } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateRoomCode } from "@/lib/api/validation";
import { RATE_LIMITS } from "@/lib/runtime/rate-limit";
import { getRateLimiter } from "@/lib/runtime/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * POST /api/rooms/{code}/answer — participant-authenticated.
 * Stale challenge ids are rejected with STALE_CHALLENGE (409) so a solved
 * challenge can never advance the room twice (RR-GAME-005).
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);

    const bearer = getBearerToken(req);
    const participantId = getParticipantId(req);
    if (bearer === null || participantId === null) throw apiError("UNAUTHORIZED");

    const store = createStore();
    if (!(await store.verifyParticipantToken(code, participantId, bearer))) {
      throw apiError("UNAUTHORIZED");
    }

    const limiter = getRateLimiter();
    if (
      !(await limiter.allow("answer", participantId, RATE_LIMITS.answer.limit, RATE_LIMITS.answer.windowMs))
    ) {
      throw apiError("RATE_LIMITED");
    }

    let body: unknown;
    try {
      body = await readJsonBody(req, 64 * 1024);
    } catch {
      throw apiError("INVALID_REQUEST");
    }
    if (typeof body !== "object" || body === null) throw apiError("INVALID_REQUEST");
    const record = body as Record<string, unknown>;
    if (typeof record.challengeId !== "string" || record.challengeId.length === 0) {
      throw apiError("INVALID_REQUEST");
    }

    const result = await store.submitAnswer(code, participantId, record.challengeId, record.answer);
    return Response.json({ ok: true, data: result }, { headers: noStoreHeaders() });
  });
}
