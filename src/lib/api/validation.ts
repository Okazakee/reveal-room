import { apiError } from "@/lib/api/errors";
import {
  CHALLENGE_COUNT_OPTIONS,
  DISPLAY_NAME_MAX_GRAPHENES,
  FINAL_MESSAGE_MAX_GRAPHENES,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SECRET_MAX_BYTES,
  SECRET_MAX_GRAPHENES,
  TITLE_MAX_GRAPHENES,
} from "@/lib/types";
import type {
  ChallengeType,
  GameMode,
  HostActionName,
  Locale,
  RevealMode,
} from "@/lib/types";

let segmenter: Intl.Segmenter | undefined;

function graphemeSegmenter(): Intl.Segmenter {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return segmenter;
}

/** Split a string into grapheme clusters (emoji/combining-mark safe). */
export function toGraphemes(value: string): string[] {
  return [...graphemeSegmenter().segment(value)].map((s) => s.segment);
}

export function countGraphemes(value: string): number {
  return toGraphemes(value).length;
}

export function isWhitespace(value: string): boolean {
  return value.trim().length === 0;
}

/** Any non-whitespace grapheme counts as visible content. */
export function hasNonWhitespace(value: string): boolean {
  return toGraphemes(value).some((g) => !isWhitespace(g));
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "it";
}

export function isGameMode(value: unknown): value is GameMode {
  return value === "solo" || value === "party";
}

export function isRevealMode(value: unknown): value is RevealMode {
  return value === "progressive" || value === "final";
}

export function isChallengeCount(value: unknown): value is (typeof CHALLENGE_COUNT_OPTIONS)[number] {
  return typeof value === "number" && (CHALLENGE_COUNT_OPTIONS as readonly number[]).includes(value);
}

export function isHostActionName(value: unknown): value is HostActionName {
  return (
    value === "start" ||
    value === "pause" ||
    value === "resume" ||
    value === "skip" ||
    value === "reveal" ||
    value === "reset"
  );
}

/** Room codes are exactly 6 chars from the unambiguous alphabet. */
export function isRoomCodeFormat(code: unknown): code is string {
  if (typeof code !== "string" || code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function validateRoomCode(code: unknown): asserts code is string {
  if (!isRoomCodeFormat(code)) throw apiError("ROOM_NOT_FOUND");
}

function assertString(value: unknown): string {
  if (typeof value !== "string") throw apiError("INVALID_REQUEST");
  return value;
}

function fail(): never {
  throw apiError("INVALID_REQUEST");
}

function assertGraphemeMax(value: string, max: number): void {
  if (countGraphemes(value) > max) fail();
}

export function validateSecret(secret: unknown): string {
  const value = assertString(secret);
  if (!hasNonWhitespace(value)) fail();
  if (countGraphemes(value) > SECRET_MAX_GRAPHENES) fail();
  if (Buffer.byteLength(value, "utf8") > SECRET_MAX_BYTES) fail();
  return value;
}

export function validateTitle(title: unknown): string | undefined {
  if (title === undefined || title === null || title === "") return undefined;
  const value = assertString(title);
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  assertGraphemeMax(trimmed, TITLE_MAX_GRAPHENES);
  return trimmed;
}

export function validateFinalMessage(message: unknown): string | undefined {
  if (message === undefined || message === null || message === "") return undefined;
  const value = assertString(message);
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  assertGraphemeMax(trimmed, FINAL_MESSAGE_MAX_GRAPHENES);
  return trimmed;
}

export function validateDisplayName(name: unknown): string {
  const value = assertString(name);
  const trimmed = value.trim();
  if (!hasNonWhitespace(trimmed)) fail();
  if (countGraphemes(trimmed) > DISPLAY_NAME_MAX_GRAPHENES) fail();
  return trimmed;
}

/** Full create-room body validation. Throws INVALID_REQUEST on any violation. */
export function validateCreateBody(body: unknown): {
  secret: string;
  title?: string;
  finalMessage?: string;
  locale: Locale;
  gameMode: GameMode;
  revealMode: RevealMode;
  challengeCount: (typeof CHALLENGE_COUNT_OPTIONS)[number];
} {
  if (typeof body !== "object" || body === null) throw apiError("INVALID_REQUEST");
  const record = body as Record<string, unknown>;

  const secret = validateSecret(record.secret);
  const title = validateTitle(record.title);
  const finalMessage = validateFinalMessage(record.finalMessage);

  if (!isLocale(record.locale)) fail();
  if (!isGameMode(record.gameMode)) fail();
  if (!isRevealMode(record.revealMode)) fail();
  if (!isChallengeCount(record.challengeCount)) fail();

  return {
    secret,
    title,
    finalMessage,
    locale: record.locale,
    gameMode: record.gameMode,
    revealMode: record.revealMode,
    challengeCount: record.challengeCount,
  };
}

/**
 * Shape-only validation of a submitted answer. Correctness comparison lives
 * in the puzzle engine. Returns true when the value has the right structure
 * for the puzzle type, false otherwise (rejected as INVALID_REQUEST).
 */
export function validateAnswerShape(type: ChallengeType, answer: unknown): boolean {
  switch (type) {
    case "sequence":
    case "quick-math":
      return typeof answer === "number" && Number.isInteger(answer) && Number.isFinite(answer);
    case "odd-one-out":
      return typeof answer === "number" && Number.isInteger(answer) && answer >= 0;
    case "word-scramble":
      return typeof answer === "string" && answer.length > 0;
    case "memory":
    case "order":
      return (
        Array.isArray(answer) &&
        answer.length > 0 &&
        answer.every((v) => typeof v === "string" || (typeof v === "number" && Number.isInteger(v)))
      );
  }
}
