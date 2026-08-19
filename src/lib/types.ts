/**
 * Core domain types for Reveal Room.
 * These are the shared contracts between the runtime, the API layer,
 * and (for the public snapshot) the client.
 */

export type Locale = "en" | "it";

export type GameMode = "solo" | "party";

export type RevealMode = "progressive" | "final";

export type RoomStatus = "lobby" | "playing" | "paused" | "completed";

export type ParticipantRole = "player" | "spectator";

export type ChallengeType =
  | "sequence"
  | "memory"
  | "odd-one-out"
  | "quick-math"
  | "word-scramble"
  | "order";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const ROOM_CODE_LENGTH = 6;

export const CHALLENGE_COUNT_OPTIONS = [3, 4, 5, 6, 7, 8] as const;

export const MAX_PARTICIPANTS_PER_ROOM = 20;

export const MAX_GAME_PLAYERS = 12;

export const PRESENCE_TIMEOUT_MS = 45_000;

export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

export const ABSOLUTE_ROOM_TTL_MS = 24 * 60 * 60_000;

export const HEARTBEAT_INTERVAL_MS = 15_000;

export const SECRET_MAX_GRAPHENES = 280;

export const SECRET_MAX_BYTES = 2 * 1024;

export const TITLE_MAX_GRAPHENES = 80;

export const FINAL_MESSAGE_MAX_GRAPHENES = 160;

export const DISPLAY_NAME_MAX_GRAPHENES = 24;

export interface PresenceState {
  lastSeenAt: number;
}

export interface Participant {
  id: string;
  tokenHash: string;
  displayName: string;
  role: ParticipantRole;
  joinedAt: number;
  presence: PresenceState;
  assignedCount: number;
  completedCount: number;
}

export interface ChallengeInstance {
  id: string;
  /** 1-based challenge number within the game. */
  index: number;
  type: ChallengeType;
  assigneeId: string;
  /** Client-safe puzzle payload. Never includes the answer. */
  payload: unknown;
  /** Canonical server-side answer. */
  answer: unknown;
  attempts: number;
  createdAt: number;
  completedAt?: number;
  skipped?: boolean;
}

export interface Room {
  /** Monotonic mutation counter; incremented on every visible/state mutation. */
  version: number;
  code: string;
  title: string;
  secret: string;
  finalMessage?: string;
  locale: Locale;
  gameMode: GameMode;
  revealMode: RevealMode;
  challengeCount: number;

  status: RoomStatus;

  hostTokenHash: string;
  hostPresence: PresenceState;

  participants: Map<string, Participant>;

  currentChallenge?: ChallengeInstance;
  challengeHistory: ChallengeInstance[];

  /** Shuffled indexes of maskable graphemes; the progressive reveal order. */
  revealOrder: number[];
  revealedMaskableCount: number;

  createdAt: number;
  startedAt?: number;
  completedAt?: number;

  /** Puzzle types already used in this game, for no-repeat selection. */
  usedTypes: ChallengeType[];
}

export interface PublicRosterEntry {
  id: string;
  displayName: string;
  role: ParticipantRole;
  isActive: boolean;
  assignedCount: number;
  completedCount: number;
}

export interface PublicRoomState {
  version: number;
  code: string;
  title: string;
  locale: Locale;
  gameMode: GameMode;
  revealMode: RevealMode;
  challengeCount: number;
  status: RoomStatus;

  maskedSecret: string;
  isFullyRevealed: boolean;
  finalMessage?: string;

  progress: {
    completed: number;
    total: number;
    percentage: number;
  };

  roster: PublicRosterEntry[];

  currentChallenge?: {
    id: string;
    index: number;
    type: ChallengeType;
    assigneeId: string;
  };

  stats?: {
    elapsedMs: number;
    totalAttempts: number;
  };
}

/** Discriminated host control actions. */
export type HostAction =
  | { action: "start" }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "skip" }
  | { action: "reveal" }
  | { action: "reset" };

export type HostActionName = HostAction["action"];
