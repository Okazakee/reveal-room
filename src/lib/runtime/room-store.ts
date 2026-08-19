import { apiError } from "@/lib/api/errors";
import { validateAnswerShape } from "@/lib/api/validation";
import { generateChallenge, isAnswerCorrect, pickChallengeType } from "@/lib/game/challenges";
import {
  createRevealOrder,
  renderMasked,
  revealTarget,
  splitSecret,
} from "@/lib/game/reveal";
import { logRoomEvent } from "@/lib/log";
import type { RoomRepository } from "@/lib/runtime/room-repository";
import {
  generateHostToken,
  generateParticipantToken,
  generateRoomCode,
  hashToken,
  pickRandom,
  randomToken,
  verifyToken,
} from "@/lib/security/tokens";
import {
  MAX_GAME_PLAYERS,
  MAX_PARTICIPANTS_PER_ROOM,
  PRESENCE_TIMEOUT_MS,
} from "@/lib/types";
import type {
  ChallengeInstance,
  GameMode,
  HostAction,
  Locale,
  Participant,
  ParticipantRole,
  PublicRoomState,
  RevealMode,
  Room,
} from "@/lib/types";

export interface CreateRoomInput {
  secret: string;
  title?: string;
  finalMessage?: string;
  locale: Locale;
  gameMode: GameMode;
  revealMode: RevealMode;
  challengeCount: number;
}

export interface JoinResult {
  participant: Participant;
  token: string;
}

const DEFAULT_TITLE: Record<Locale, string> = {
  en: "A secret is waiting",
  it: "C'è una sorpresa da sbloccare",
};

const ROOM_CODE_RETRIES = 5;

/**
 * Domain layer (spec v1.2 §10). All room state goes through a
 * `RoomRepository`; every mutation runs under the repository's per-room
 * distributed lock, so concurrent Vercel function instances cannot corrupt
 * a room. The repository increments `version` and applies Redis TTL on every
 * successful mutation.
 *
 * `now` is injectable so lifecycle tests use a fake clock.
 */
export class RoomStore {
  private readonly repository: RoomRepository;
  private readonly now: () => number;

  constructor(repository: RoomRepository, now: () => number = Date.now) {
    this.repository = repository;
    this.now = now;
  }

  // --------------------------------------------------------------- tokens

  /** True when the presented host token matches the room's stored hash. */
  async verifyHostToken(code: string, token: string): Promise<boolean> {
    const room = await this.repository.get(code);
    if (room === null) return false;
    return verifyToken(token, room.hostTokenHash);
  }

  /** True when the presented participant token matches the stored hash. */
  async verifyParticipantToken(code: string, participantId: string, token: string): Promise<boolean> {
    const room = await this.repository.get(code);
    if (room === null) return false;
    const participant = room.participants.get(participantId);
    if (participant === undefined) return false;
    return verifyToken(token, participant.tokenHash);
  }

  // ----------------------------------------------------------------- create

  async create(input: CreateRoomInput): Promise<{ room: Room; hostToken: string }> {
    const now = this.now();
    const hostToken = generateHostToken();
    const room: Room = {
      version: 1,
      code: "",
      title: input.title ?? DEFAULT_TITLE[input.locale],
      secret: input.secret,
      finalMessage: input.finalMessage,
      locale: input.locale,
      gameMode: input.gameMode,
      revealMode: input.revealMode,
      challengeCount: input.challengeCount,
      status: "lobby",
      hostTokenHash: hashToken(hostToken),
      hostPresence: { lastSeenAt: now },
      participants: new Map(),
      challengeHistory: [],
      revealOrder: createRevealOrder(input.secret),
      revealedMaskableCount: 0,
      createdAt: now,
      usedTypes: [],
    };
    // Atomic create-if-absent with bounded collision retries.
    for (let attempt = 0; attempt < ROOM_CODE_RETRIES; attempt++) {
      room.code = generateRoomCode();
      if (await this.repository.create(room)) {
        logRoomEvent(`room_created code=${room.code}`);
        return { room, hostToken };
      }
    }
    throw apiError("ROOM_LIMIT_REACHED"); // collision exhaustion; effectively impossible
  }

  // -------------------------------------------------------------- presence

  async touchHostPresence(code: string): Promise<void> {
    const now = this.now();
    const changed = await this.repository.mutate(code, (room) => {
      room.hostPresence.lastSeenAt = now;
      return this.normalizeChallenge(room, now);
    });
    if (changed === null) throw apiError("ROOM_NOT_FOUND");
  }

  async touchParticipantPresence(code: string, participantId: string): Promise<void> {
    const now = this.now();
    const changed = await this.repository.mutate(code, (room) => {
      const participant = room.participants.get(participantId);
      if (participant === undefined) throw apiError("UNAUTHORIZED");
      participant.presence.lastSeenAt = now;
      return this.normalizeChallenge(room, now);
    });
    if (changed === null) throw apiError("ROOM_NOT_FOUND");
  }

  // ----------------------------------------------------------------- joins

  async join(code: string, displayName: string): Promise<JoinResult> {
    const now = this.now();
    const result = await this.repository.mutate(code, (room) => {
      if (room.participants.size >= MAX_PARTICIPANTS_PER_ROOM) throw apiError("ROOM_FULL");
      const token = generateParticipantToken();
      const participant: Participant = {
        id: randomToken(8),
        tokenHash: hashToken(token),
        displayName,
        role: this.joinRole(room),
        joinedAt: now,
        presence: { lastSeenAt: now },
        assignedCount: 0,
        completedCount: 0,
      };
      room.participants.set(participant.id, participant);
      return { participant, token };
    });
    if (result === null) throw apiError("ROOM_NOT_FOUND");
    return result;
  }

  /** Resume an existing participant with stored credentials (no token rotation). */
  async resume(code: string, participantId: string, token: string): Promise<Participant> {
    const now = this.now();
    const participant = await this.repository.mutate(code, (room) => {
      const existing = room.participants.get(participantId);
      if (existing === undefined || !verifyToken(token, existing.tokenHash)) {
        throw apiError("UNAUTHORIZED");
      }
      existing.presence.lastSeenAt = now;
      return existing;
    });
    if (participant === null) throw apiError("ROOM_NOT_FOUND");
    return participant;
  }

  private joinRole(room: Room): ParticipantRole {
    if (room.status !== "lobby") return "spectator";
    if (room.gameMode === "solo") {
      const hasPlayer = [...room.participants.values()].some((p) => p.role === "player");
      return hasPlayer ? "spectator" : "player";
    }
    const playerCount = [...room.participants.values()].filter((p) => p.role === "player").length;
    return playerCount < MAX_GAME_PLAYERS ? "player" : "spectator";
  }

  // ------------------------------------------------------------------- game

  async getChallenge(code: string, participantId: string): Promise<ChallengeInstance> {
    const now = this.now();
    const challenge = await this.repository.mutate(code, (room) => {
      const participant = room.participants.get(participantId);
      if (participant === undefined) throw apiError("UNAUTHORIZED");
      participant.presence.lastSeenAt = now; // authenticated activity refreshes presence
      const current = room.currentChallenge;
      if (current === undefined) throw apiError("CHALLENGE_NOT_FOUND");
      if (room.status === "completed" || current.assigneeId !== participantId) {
        throw apiError("NOT_ASSIGNEE");
      }
      return current;
    });
    if (challenge === null) throw apiError("ROOM_NOT_FOUND");
    return challenge;
  }

  async submitAnswer(
    code: string,
    participantId: string,
    challengeId: string,
    answer: unknown,
  ): Promise<{ correct: boolean }> {
    const now = this.now();
    const result = await this.repository.mutate(code, (room) => {
      const participant = room.participants.get(participantId);
      if (participant === undefined) throw apiError("UNAUTHORIZED");
      participant.presence.lastSeenAt = now;

      const challenge = room.currentChallenge;
      if (challenge === undefined) throw apiError("CHALLENGE_NOT_FOUND");
      // Stale challenge ids (already solved/skipped/revealed) must never
      // advance the room again (RR-GAME-005).
      if (challenge.id !== challengeId) throw apiError("STALE_CHALLENGE");
      if (room.status !== "playing") throw apiError("INVALID_STATE");
      if (challenge.assigneeId !== participantId) throw apiError("NOT_ASSIGNEE");
      if (!validateAnswerShape(challenge.type, answer)) throw apiError("INVALID_REQUEST");

      challenge.attempts += 1;
      if (!isAnswerCorrect(challenge.type, answer, challenge.answer)) {
        return { correct: false };
      }

      this.completeChallenge(room, challenge, false, now);
      return { correct: true };
    });
    if (result === null) throw apiError("ROOM_NOT_FOUND");
    return result;
  }

  async hostAction(code: string, action: HostAction): Promise<void> {
    const now = this.now();
    const result = await this.repository.mutate(code, (room) => {
      if (room.status === "completed" && action.action !== "reset") throw apiError("INVALID_STATE");

      switch (action.action) {
        case "start": {
          if (room.status !== "lobby") throw apiError("INVALID_STATE");
          const activePlayers = this.activeGamePlayers(room, now);
          if (room.gameMode === "solo") {
            if (activePlayers.length < 1) throw apiError("PLAYER_REQUIRED");
          } else if (activePlayers.length < 2) {
            throw apiError("PLAYERS_REQUIRED");
          }
          room.status = "playing";
          room.startedAt = now;
          this.generateNextChallenge(room, now);
          logRoomEvent(`room_started code=${room.code} players=${activePlayers.length}`);
          break;
        }
        case "pause": {
          if (room.status !== "playing") throw apiError("INVALID_STATE");
          room.status = "paused";
          break;
        }
        case "resume": {
          if (room.status !== "paused") throw apiError("INVALID_STATE");
          room.status = "playing";
          this.normalizeChallenge(room, now);
          break;
        }
        case "skip": {
          if (room.status !== "playing" && room.status !== "paused") throw apiError("INVALID_STATE");
          const challenge = room.currentChallenge;
          if (challenge === undefined) throw apiError("CHALLENGE_NOT_FOUND");
          this.completeChallenge(room, challenge, true, now);
          break;
        }
        case "reveal": {
          if (room.status !== "playing" && room.status !== "paused") throw apiError("INVALID_STATE");
          const { maskableIndexes } = splitSecret(room.secret);
          room.revealedMaskableCount = maskableIndexes.length;
          room.status = "completed";
          room.completedAt = now;
          room.currentChallenge = undefined;
          logRoomEvent(`room_completed code=${room.code} reason=reveal_now`);
          break;
        }
        case "reset": {
          this.resetRoom(room);
          break;
        }
      }
      return true;
    });
    if (result === null) throw apiError("ROOM_NOT_FOUND");
  }

  /** RR-PRES-007: host-initiated immediate deletion. */
  async deleteRoom(code: string, reason: string): Promise<boolean> {
    const existed = (await this.repository.get(code)) !== null;
    if (!existed) return false;
    await this.repository.delete(code);
    logRoomEvent(`room_deleted code=${code} reason=${reason}`);
    return true;
  }

  // ---------------------------------------------------------------- state

  /**
   * Public snapshot (RR-INV-003). Read-only unless lifecycle normalization
   * (inactive assignee reassignment) is actually required; polling must not
   * write on every request.
   */
  async getPublicState(code: string): Promise<PublicRoomState> {
    const now = this.now();
    let room = await this.repository.get(code);
    if (room === null) throw apiError("ROOM_NOT_FOUND");

    if (room.status === "playing" && this.needsAssigneeReassignment(room, now)) {
      await this.repository.mutate(code, (current) => {
        this.normalizeChallenge(current, now);
        return true;
      });
      room = (await this.repository.get(code)) ?? room;
    }
    return serializePublicRoom(room, now);
  }

  // ------------------------------------------------------------ internals

  /** Returns true when a challenge was reassigned (used to avoid needless writes). */
  private normalizeChallenge(room: Room, now: number): boolean {
    if (room.status !== "playing") return false;
    return this.handleInactiveChallengeAssignee(room, now);
  }

  /** Read-only check used by the polling path before deciding to write. */
  private needsAssigneeReassignment(room: Room, now: number): boolean {
    const challenge = room.currentChallenge;
    if (challenge === undefined) return false;
    const assignee = room.participants.get(challenge.assigneeId);
    const assigneeActive =
      assignee !== undefined && now - assignee.presence.lastSeenAt <= PRESENCE_TIMEOUT_MS;
    if (assigneeActive) return false;
    return this.activeGamePlayers(room, now).length > 0;
  }

  private activeGamePlayers(room: Room, now: number): Participant[] {
    return [...room.participants.values()].filter(
      (p) => p.role === "player" && now - p.presence.lastSeenAt <= PRESENCE_TIMEOUT_MS,
    );
  }

  /** Fair assignment: lowest assignedCount among active players, random tie-break. */
  private pickAssignee(room: Room, now: number): Participant | undefined {
    const candidates = this.activeGamePlayers(room, now);
    if (candidates.length === 0) return undefined;
    let min = Infinity;
    for (const candidate of candidates) {
      if (candidate.assignedCount < min) min = candidate.assignedCount;
    }
    const tied = candidates.filter((c) => c.assignedCount === min);
    return pickRandom(tied);
  }

  private generateNextChallenge(room: Room, now: number): void {
    const index = room.challengeHistory.length + 1;
    const type = pickChallengeType(room.usedTypes);
    room.usedTypes.push(type);
    const { payload, answer } = generateChallenge(type, room.locale);
    const assignee = this.pickAssignee(room, now);
    if (assignee !== undefined) assignee.assignedCount += 1;
    const challenge: ChallengeInstance = {
      id: randomToken(8),
      index,
      type,
      assigneeId: assignee?.id ?? "",
      payload,
      answer,
      attempts: 0,
      createdAt: now,
    };
    room.currentChallenge = challenge;
  }

  /**
   * RR-GAME-003: when the current assignee is inactive past the presence
   * window and another active game player exists, move the same challenge
   * (answer unchanged) to an eligible player. No-op otherwise.
   */
  private handleInactiveChallengeAssignee(room: Room, now: number): boolean {
    const challenge = room.currentChallenge;
    if (challenge === undefined) return false;
    const assignee = room.participants.get(challenge.assigneeId);
    const assigneeActive =
      assignee !== undefined && now - assignee.presence.lastSeenAt <= PRESENCE_TIMEOUT_MS;
    if (assigneeActive) return false;
    const replacement = this.pickAssignee(room, now);
    if (replacement === undefined || replacement.id === challenge.assigneeId) return false;
    challenge.assigneeId = replacement.id;
    return true;
  }

  /**
   * Complete the current challenge: record it, advance the reveal, then
   * either finish the room or generate+assign the next challenge.
   * Used for both correct answers and host skips (RR-GAME-004, RR-HOST-CTRL-002).
   */
  private completeChallenge(room: Room, challenge: ChallengeInstance, skipped: boolean, now: number): void {
    challenge.completedAt = now;
    challenge.skipped = skipped;
    room.challengeHistory.push(challenge);
    room.currentChallenge = undefined;
    if (!skipped) {
      const assignee = room.participants.get(challenge.assigneeId);
      if (assignee !== undefined) assignee.completedCount += 1;
    }

    const { maskableIndexes } = splitSecret(room.secret);
    const completed = room.challengeHistory.length;
    const total = room.challengeCount;

    if (completed >= total) {
      room.revealedMaskableCount = maskableIndexes.length;
      room.status = "completed";
      room.completedAt = now;
      logRoomEvent(`room_completed code=${room.code} duration_ms=${Math.max(0, now - (room.startedAt ?? now))}`);
      return;
    }
    room.revealedMaskableCount = revealTarget(
      room.revealMode,
      completed,
      total,
      maskableIndexes.length,
    );
    this.generateNextChallenge(room, now);
  }

  /** RR-STATE-002: reset keeps room config and participants, clears game state. */
  private resetRoom(room: Room): void {
    room.status = "lobby";
    room.startedAt = undefined;
    room.completedAt = undefined;
    room.currentChallenge = undefined;
    room.challengeHistory = [];
    room.revealedMaskableCount = 0;
    room.usedTypes = [];

    const sorted = [...room.participants.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    if (room.gameMode === "solo") {
      sorted.forEach((p, i) => {
        p.role = i === 0 ? "player" : "spectator";
      });
    } else {
      sorted.forEach((p, i) => {
        p.role = i < MAX_GAME_PLAYERS ? "player" : "spectator";
      });
    }
    for (const p of room.participants.values()) {
      p.assignedCount = 0;
      p.completedCount = 0;
    }
  }
}

/**
 * The one public sanitizer (RR-INV-003, RR-INV-007).
 *
 * Structural safety: PublicRoomState has no field for the plaintext secret.
 * `maskedSecret` is derived by renderMasked, which can only emit a revealed
 * grapheme (already public) or a bullet. There is no option that could
 * accidentally include the secret; callers cannot opt into leakage.
 * `version` is the only persistence-adjacent value exposed, and it is safe.
 */
export function serializePublicRoom(room: Room, now: number): PublicRoomState {
  const { maskableIndexes } = splitSecret(room.secret);
  const isFullyRevealed = room.revealedMaskableCount >= maskableIndexes.length;

  const roster = [...room.participants.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      role: p.role,
      isActive: now - p.presence.lastSeenAt <= PRESENCE_TIMEOUT_MS,
      assignedCount: p.assignedCount,
      completedCount: p.completedCount,
    }));

  const completed = room.challengeHistory.length;
  const state: PublicRoomState = {
    version: room.version,
    code: room.code,
    title: room.title,
    locale: room.locale,
    gameMode: room.gameMode,
    revealMode: room.revealMode,
    challengeCount: room.challengeCount,
    status: room.status,
    maskedSecret: renderMasked(room.secret, room.revealOrder, room.revealedMaskableCount),
    isFullyRevealed,
    progress: {
      completed,
      total: room.challengeCount,
      percentage: room.challengeCount === 0 ? 0 : Math.round((completed / room.challengeCount) * 100),
    },
    roster,
  };

  if (room.finalMessage !== undefined && isFullyRevealed) state.finalMessage = room.finalMessage;
  if (room.currentChallenge !== undefined) {
    state.currentChallenge = {
      id: room.currentChallenge.id,
      index: room.currentChallenge.index,
      type: room.currentChallenge.type,
      assigneeId: room.currentChallenge.assigneeId,
    };
  }
  if (room.startedAt !== undefined) {
    let totalAttempts = 0;
    for (const challenge of room.challengeHistory) totalAttempts += challenge.attempts;
    if (room.currentChallenge !== undefined) totalAttempts += room.currentChallenge.attempts;
    state.stats = {
      elapsedMs: Math.max(0, (room.completedAt ?? now) - room.startedAt),
      totalAttempts,
    };
  }
  return state;
}
