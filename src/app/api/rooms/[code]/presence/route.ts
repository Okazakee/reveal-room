import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, getParticipantId, noStoreHeaders } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateRoomCode } from "@/lib/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * POST /api/rooms/{code}/presence — authenticated heartbeat (RR-PRES-001).
 * Accepts either a host token or a participant token (+ participant id).
 * Polling GET is never the presence authority; this authenticated mutation is.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);

    const bearer = getBearerToken(req);
    if (bearer === null) throw apiError("UNAUTHORIZED");

    const store = createStore();
    const participantId = getParticipantId(req);
    let authenticated = false;

    if (participantId !== null && (await store.verifyParticipantToken(code, participantId, bearer))) {
      await store.touchParticipantPresence(code, participantId);
      authenticated = true;
    } else if (await store.verifyHostToken(code, bearer)) {
      await store.touchHostPresence(code);
      authenticated = true;
    }

    if (!authenticated) throw apiError("UNAUTHORIZED");
    return new Response(null, { status: 204, headers: noStoreHeaders() });
  });
}
