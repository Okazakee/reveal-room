/**
 * Machine-readable API error codes and the ApiError type.
 * The server never localizes error prose; clients map codes to dictionary
 * entries.
 */

export const API_ERROR_CODES = [
  "INVALID_REQUEST",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_LIMIT_REACHED",
  "UNAUTHORIZED",
  "INVALID_STATE",
  "PLAYER_REQUIRED",
  "PLAYERS_REQUIRED",
  "NOT_ASSIGNEE",
  "CHALLENGE_NOT_FOUND",
  "STALE_CHALLENGE",
  "RATE_LIMITED",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 403,
  ROOM_LIMIT_REACHED: 503,
  UNAUTHORIZED: 401,
  INVALID_STATE: 409,
  PLAYER_REQUIRED: 409,
  PLAYERS_REQUIRED: 409,
  NOT_ASSIGNEE: 403,
  CHALLENGE_NOT_FOUND: 404,
  STALE_CHALLENGE: 409,
  RATE_LIMITED: 429,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status?: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status ?? DEFAULT_STATUS[code];
  }
}

export function apiError(code: ApiErrorCode, status?: number): ApiError {
  return new ApiError(code, status);
}

/** JSON body for a failed API call: { ok: false, error: { code } }. */
export function errorBody(error: ApiError): { ok: false; error: { code: ApiErrorCode } } {
  return { ok: false, error: { code: error.code } };
}
