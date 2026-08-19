import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, getParticipantId, noStoreHeaders } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateRoomCode } from "@/lib/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * GET /api/rooms/{code}/challenge — participant-authenticated.
 * Only the current assignee receives the client-safe payload; the answer is
 * never returned and non-assignees get NOT_ASSIGNEE without any payload
 * leakage (RR-19.5).
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
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

    const challenge = await store.getChallenge(code, participantId);
    return Response.json(
      {
        ok: true,
        data: {
          id: challenge.id,
          index: challenge.index,
          type: challenge.type,
          payload: challenge.payload,
        },
      },
      { headers: noStoreHeaders() },
    );
  });
}
