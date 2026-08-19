import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, getClientIp, getParticipantId, noStoreHeaders, readJsonBody } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateDisplayName, validateRoomCode } from "@/lib/api/validation";
import { RATE_LIMITS } from "@/lib/runtime/rate-limit";
import { getRateLimiter } from "@/lib/runtime/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * POST /api/rooms/{code}/join
 *
 * Two modes:
 * - Resume: Bearer participant token + X-Participant-Id header, no display
 *   name. Returns the existing participant without rotating the token.
 * - New join: `{ displayName }`. Returns participantId, participantToken
 *   (plaintext once, stored client-side as hash server-side) and the room.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);

    const ip = getClientIp(req);
    const limiter = getRateLimiter();
    if (!(await limiter.allow("join", ip, RATE_LIMITS.join.limit, RATE_LIMITS.join.windowMs))) {
      throw apiError("RATE_LIMITED");
    }

    const bearer = getBearerToken(req);
    const participantId = getParticipantId(req);
    const store = createStore();

    // Resume path: invalid stored credentials are surfaced as UNAUTHORIZED
    // so the client discards them and shows the normal join state.
    if (bearer !== null && participantId !== null) {
      const participant = await store.resume(code, participantId, bearer);
      const room = await store.getPublicState(code);
      return Response.json(
        {
          ok: true,
          data: { participantId: participant.id, role: participant.role, room },
        },
        { headers: noStoreHeaders() },
      );
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      throw apiError("INVALID_REQUEST");
    }
    if (typeof body !== "object" || body === null) throw apiError("INVALID_REQUEST");
    const displayName = validateDisplayName((body as Record<string, unknown>).displayName);

    const result = await store.join(code, displayName);
    return Response.json(
      {
        ok: true,
        data: {
          participantId: result.participant.id,
          participantToken: result.token,
          role: result.participant.role,
          room: await store.getPublicState(code),
        },
      },
      { headers: noStoreHeaders() },
    );
  });
}
