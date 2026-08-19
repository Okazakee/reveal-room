import { ApiError, apiError } from "@/lib/api/errors";
import { createStore } from "@/lib/api/context";
import { getBearerToken, noStoreHeaders } from "@/lib/api/http";
import { handleRoute } from "@/lib/api/route";
import { validateRoomCode } from "@/lib/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/** GET /api/rooms/{code} — public sanitized snapshot only. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);
    const state = await createStore().getPublicState(code);
    return Response.json({ ok: true, data: state }, { headers: noStoreHeaders() });
  });
}

/** DELETE /api/rooms/{code} — host-authenticated immediate deletion. */
export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  return handleRoute(async () => {
    const { code } = await params;
    validateRoomCode(code);
    const token = getBearerToken(req);
    if (token === null) throw new ApiError("UNAUTHORIZED");
    const store = createStore();
    if (!(await store.verifyHostToken(code, token))) throw apiError("UNAUTHORIZED");
    await store.deleteRoom(code, "host");
    return new Response(null, { status: 204, headers: noStoreHeaders() });
  });
}
