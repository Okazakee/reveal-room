"use client";

const HOST_KEY = (code: string) => `reveal-room:host:${code}`;
const PLAYER_KEY = (code: string) => `reveal-room:player:${code}`;

export interface StoredParticipantCredentials {
  participantId: string;
  participantToken: string;
}

/** Host token lives only in localStorage (RR-SEC-002), never in URLs. */
export function saveHostToken(code: string, token: string): void {
  try {
    window.localStorage.setItem(HOST_KEY(code), token);
  } catch {
    // Storage unavailable; the host simply cannot persist — room still works.
  }
}

export function getHostToken(code: string): string | null {
  try {
    return window.localStorage.getItem(HOST_KEY(code));
  } catch {
    return null;
  }
}

export function clearHostToken(code: string): void {
  try {
    window.localStorage.removeItem(HOST_KEY(code));
  } catch {
    // ignore
  }
}

/** Participant credentials under a room-specific key for resume (RR-SEC-004). */
export function saveParticipantCredentials(code: string, credentials: StoredParticipantCredentials): void {
  try {
    window.localStorage.setItem(PLAYER_KEY(code), JSON.stringify(credentials));
  } catch {
    // ignore
  }
}

export function getParticipantCredentials(code: string): StoredParticipantCredentials | null {
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY(code));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredParticipantCredentials).participantId === "string" &&
      typeof (parsed as StoredParticipantCredentials).participantToken === "string"
    ) {
      return parsed as StoredParticipantCredentials;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearParticipantCredentials(code: string): void {
  try {
    window.localStorage.removeItem(PLAYER_KEY(code));
  } catch {
    // ignore
  }
}
