import { createHash, randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/types";

/** Cryptographically random token encoded as base64url. */
export function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Host tokens are >= 256 bits; participant tokens >= 128 bits. */
export const HOST_TOKEN_BYTES = 32;
export const PARTICIPANT_TOKEN_BYTES = 16;

export function generateHostToken(): string {
  return randomToken(HOST_TOKEN_BYTES);
}

export function generateParticipantToken(): string {
  return randomToken(PARTICIPANT_TOKEN_BYTES);
}

/** SHA-256 hex digest; the only representation of a token stored in room state. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison of a presented token against a stored digest.
 * Both inputs are equal-length hex digests, so timingSafeEqual is valid.
 */
export function verifyToken(presentedToken: string, storedHash: string): boolean {
  const presentedHash = hashToken(presentedToken);
  const a = Buffer.from(presentedHash, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Generate a random uppercase room code from the unambiguous alphabet. */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Cryptographically secure Fisher–Yates shuffle. */
export function secureShuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Uniform random integer in [min, max] inclusive. */
export function randomIntInclusive(min: number, max: number): number {
  return randomInt(min, max + 1);
}

/** Pick one random element. */
export function pickRandom<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]!;
}
