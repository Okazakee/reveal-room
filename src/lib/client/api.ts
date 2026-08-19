"use client";

import type { Messages } from "@/lib/i18n";

/** Error raised by the client API layer with the machine-readable code. */
export class ClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "ClientError";
    this.code = code;
    this.status = status;
  }
}

interface ApiFailure {
  ok: false;
  error: { code: string };
}

async function parse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as
    | ({ ok: true; data: T } | ApiFailure | null);
  if (!response.ok || json === null || json.ok !== true) {
    const code = json !== null && "error" in json ? json.error.code : "INVALID_REQUEST";
    throw new ClientError(code, response.status);
  }
  return json.data;
}

export interface CreateRoomBody {
  secret: string;
  title?: string;
  finalMessage?: string;
  locale: "en" | "it";
  gameMode: "solo" | "party";
  revealMode: "progressive" | "final";
  challengeCount: number;
}

export interface CreateRoomResult {
  code: string;
  hostToken: string;
  playerPath: string;
  hostPath: string;
}

export function apiCreateRoom(body: CreateRoomBody): Promise<CreateRoomResult> {
  return fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).then((res) => parse<CreateRoomResult>(res));
}

export interface JoinRoomResult {
  participantId: string;
  participantToken?: string;
  role: "player" | "spectator";
  room: import("@/lib/types").PublicRoomState;
}

export function apiJoinRoom(code: string, displayName: string): Promise<JoinRoomResult> {
  return fetch(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
    cache: "no-store",
  }).then((res) => parse<JoinRoomResult>(res));
}

export function apiResumeRoom(code: string, participantId: string, token: string): Promise<JoinRoomResult> {
  return fetch(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Participant-Id": participantId,
    },
    body: "{}",
    cache: "no-store",
  }).then((res) => parse<JoinRoomResult>(res));
}

export function apiPresence(code: string, token: string, participantId?: string): Promise<Response> {
  return fetch(`/api/rooms/${code}/presence`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(participantId !== undefined ? { "X-Participant-Id": participantId } : {}),
    },
    cache: "no-store",
  });
}

export function apiHostAction(code: string, token: string, action: string): Promise<void> {
  return fetch(`/api/rooms/${code}/host-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }),
    cache: "no-store",
  }).then((res) => parse<{ ok: boolean }>(res).then(() => undefined));
}

export function apiDeleteRoom(code: string, token: string): Promise<void> {
  return fetch(`/api/rooms/${code}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).then((res) => {
    if (!res.ok && res.status !== 204) {
      return parse<never>(res);
    }
  });
}

export interface ChallengePayload {
  id: string;
  index: number;
  type: import("@/lib/types").ChallengeType;
  payload: unknown;
}

export function apiFetchChallenge(code: string, token: string, participantId: string): Promise<ChallengePayload> {
  return fetch(`/api/rooms/${code}/challenge`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Participant-Id": participantId,
    },
    cache: "no-store",
  }).then((res) => parse<ChallengePayload>(res));
}

export function apiSubmitAnswer(
  code: string,
  token: string,
  participantId: string,
  challengeId: string,
  answer: unknown,
): Promise<{ correct: boolean }> {
  return fetch(`/api/rooms/${code}/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Participant-Id": participantId,
    },
    body: JSON.stringify({ challengeId, answer }),
    cache: "no-store",
  }).then((res) => parse<{ correct: boolean }>(res));
}

const ERROR_KEY_MAP: Record<string, string> = {
  INVALID_REQUEST: "errInvalidRequest",
  ROOM_NOT_FOUND: "errRoomNotFound",
  ROOM_FULL: "errRoomFull",
  ROOM_LIMIT_REACHED: "errRoomLimitReached",
  UNAUTHORIZED: "errUnauthorized",
  INVALID_STATE: "errInvalidState",
  PLAYER_REQUIRED: "errPlayerRequired",
  PLAYERS_REQUIRED: "errPlayersRequired",
  NOT_ASSIGNEE: "errNotAssignee",
  CHALLENGE_NOT_FOUND: "errChallengeNotFound",
  STALE_CHALLENGE: "errStaleChallenge",
  RATE_LIMITED: "errRateLimited",
};

/** Localize any thrown error into a user-facing message (RR-20). */
export function errorMessage(t: Messages, error: unknown): string {
  if (error instanceof ClientError) {
    const key = ERROR_KEY_MAP[error.code];
    if (key !== undefined) return t[key as keyof Messages] as string;
  }
  if (error instanceof TypeError) return t.errNetwork;
  return t.errUnexpected;
}
