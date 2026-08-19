import { ApiError, errorBody } from "@/lib/api/errors";
import { noStoreHeaders } from "@/lib/api/http";

/**
 * Wraps a route handler so domain ApiErrors become machine-readable JSON
 * responses ({ ok:false, error:{ code } }) with the mapped HTTP status.
 * Non-ApiError failures propagate so Next.js surfaces its generic 500
 * without exposing stack traces (RR-SEC-012).
 */
export async function handleRoute(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(errorBody(error), { status: error.status, headers: noStoreHeaders() });
    }
    throw error;
  }
}
