import type {
  ChallengeInstance,
  ChallengeType,
  Locale,
  Participant,
  ParticipantRole,
  PresenceState,
  RevealMode,
  GameMode,
  Room,
  RoomStatus,
} from "@/lib/types";

/**
 * Explicit persisted representation of a room (RR v1.2 §9).
 * Redis stores JSON; Map/Set/class structures cannot survive JSON directly,
 * so this layer is the single place that maps between the domain `Room`
 * (with `Map<string, Participant>`) and a plain serializable record.
 *
 * Runtime-only data (locks, Redis keys, subscribers) is never persisted.
 */

export interface StoredParticipant {
  id: string;
  tokenHash: string;
  displayName: string;
  role: ParticipantRole;
  joinedAt: number;
  presence: PresenceState;
  assignedCount: number;
  completedCount: number;
}

export interface StoredChallenge {
  id: string;
  index: number;
  type: ChallengeType;
  assigneeId: string;
  payload: unknown;
  answer: unknown;
  attempts: number;
  createdAt: number;
  completedAt?: number;
  skipped?: boolean;
}

export interface StoredRoom {
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
  participants: Record<string, StoredParticipant>;
  currentChallenge?: StoredChallenge;
  challengeHistory: StoredChallenge[];
  revealOrder: number[];
  revealedMaskableCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  usedTypes: ChallengeType[];
}

function toStoredChallenge(challenge: ChallengeInstance): StoredChallenge {
  return {
    id: challenge.id,
    index: challenge.index,
    type: challenge.type,
    assigneeId: challenge.assigneeId,
    payload: challenge.payload,
    answer: challenge.answer,
    attempts: challenge.attempts,
    createdAt: challenge.createdAt,
    completedAt: challenge.completedAt,
    skipped: challenge.skipped,
  };
}

function toStoredParticipant(participant: Participant): StoredParticipant {
  return {
    id: participant.id,
    tokenHash: participant.tokenHash,
    displayName: participant.displayName,
    role: participant.role,
    joinedAt: participant.joinedAt,
    presence: { lastSeenAt: participant.presence.lastSeenAt },
    assignedCount: participant.assignedCount,
    completedCount: participant.completedCount,
  };
}

export function serializeRoom(room: Room): StoredRoom {
  const participants: Record<string, StoredParticipant> = {};
  for (const [id, participant] of room.participants) {
    participants[id] = toStoredParticipant(participant);
  }
  const stored: StoredRoom = {
    version: room.version,
    code: room.code,
    title: room.title,
    secret: room.secret,
    locale: room.locale,
    gameMode: room.gameMode,
    revealMode: room.revealMode,
    challengeCount: room.challengeCount,
    status: room.status,
    hostTokenHash: room.hostTokenHash,
    hostPresence: { lastSeenAt: room.hostPresence.lastSeenAt },
    participants,
    challengeHistory: room.challengeHistory.map(toStoredChallenge),
    revealOrder: [...room.revealOrder],
    revealedMaskableCount: room.revealedMaskableCount,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    completedAt: room.completedAt,
    usedTypes: [...room.usedTypes],
  };
  if (room.finalMessage !== undefined) stored.finalMessage = room.finalMessage;
  if (room.currentChallenge !== undefined) {
    stored.currentChallenge = toStoredChallenge(room.currentChallenge);
  }
  return stored;
}

export function deserializeRoom(stored: StoredRoom): Room {
  const participants = new Map<string, Participant>();
  for (const [id, participant] of Object.entries(stored.participants)) {
    participants.set(id, {
      id: participant.id,
      tokenHash: participant.tokenHash,
      displayName: participant.displayName,
      role: participant.role,
      joinedAt: participant.joinedAt,
      presence: { lastSeenAt: participant.presence.lastSeenAt },
      assignedCount: participant.assignedCount,
      completedCount: participant.completedCount,
    });
  }

  const room: Room = {
    version: stored.version,
    code: stored.code,
    title: stored.title,
    secret: stored.secret,
    locale: stored.locale,
    gameMode: stored.gameMode,
    revealMode: stored.revealMode,
    challengeCount: stored.challengeCount,
    status: stored.status,
    hostTokenHash: stored.hostTokenHash,
    hostPresence: { lastSeenAt: stored.hostPresence.lastSeenAt },
    participants,
    challengeHistory: stored.challengeHistory.map(fromStoredChallenge),
    revealOrder: [...stored.revealOrder],
    revealedMaskableCount: stored.revealedMaskableCount,
    createdAt: stored.createdAt,
    startedAt: stored.startedAt,
    completedAt: stored.completedAt,
    usedTypes: [...stored.usedTypes],
  };
  if (stored.finalMessage !== undefined) room.finalMessage = stored.finalMessage;
  if (stored.currentChallenge !== undefined) {
    room.currentChallenge = fromStoredChallenge(stored.currentChallenge);
  }
  return room;
}

function fromStoredChallenge(stored: StoredChallenge): ChallengeInstance {
  const challenge: ChallengeInstance = {
    id: stored.id,
    index: stored.index,
    type: stored.type,
    assigneeId: stored.assigneeId,
    payload: stored.payload,
    answer: stored.answer,
    attempts: stored.attempts,
    createdAt: stored.createdAt,
    completedAt: stored.completedAt,
    skipped: stored.skipped,
  };
  return challenge;
}
