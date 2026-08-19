import { apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, noStoreHeaders, readJsonBody } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { isHostActionName, validateRoomCode } from "@/lib/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/**
 * POST /api/rooms/{code}/host-action — host-authenticated.
 * Body: { action: 'start' | 'pause' | 'resume' | 'skip' | 'reveal' | 'reset' }
 * Invalid transitions are rejected by the domain state machine with
 * INVALID_STATE (409). Runs under the per-room distributed lock.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);

    const bearer = getBearerToken(req);
    if (bearer === null) throw apiError("UNAUTHORIZED");

    const store = createStore();
    if (!(await store.verifyHostToken(code, bearer))) throw apiError("UNAUTHORIZED");

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      throw apiError("INVALID_REQUEST");
    }
    if (typeof body !== "object" || body === null) throw apiError("INVALID_REQUEST");
    const action = (body as Record<string, unknown>).action;
    if (!isHostActionName(action)) throw apiError("INVALID_REQUEST");

    await store.hostAction(code, { action });
    return Response.json({ ok: true, data: {} }, { headers: noStoreHeaders() });
  });
}
