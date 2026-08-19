import { randomToken } from "@/lib/security/tokens";
import { deserializeRoom, serializeRoom } from "@/lib/runtime/stored-room";
import {
  ABSOLUTE_ROOM_TTL_MS,
  EMPTY_ROOM_TTL_MS,
  PRESENCE_TIMEOUT_MS,
} from "@/lib/types";
import type { Room } from "@/lib/types";

/**
 * Persistence boundary (spec v1.2 §10). Game/domain code only ever talks to
 * this interface; it does not know whether rooms live in Redis or memory.
 */

export const ROOM_KEY_PREFIX = "rr:room:";
export const LOCK_KEY_PREFIX = "rr:lock:";

export function roomKey(code: string): string {
  return ROOM_KEY_PREFIX + code;
}

export function lockKey(code: string): string {
  return LOCK_KEY_PREFIX + code;
}

/**
 * TTL semantics (spec v1.2 §41):
 * expiry = min(createdAt + 24 h, latest actor lastSeenAt + 45 s + 5 min).
 * An actor is considered active for 45 s after its last presence activity,
 * and the room is retained for a further 5 minutes after that.
 */
export function roomExpiresAt(room: Room): number {
  let latest = room.hostPresence.lastSeenAt;
  for (const participant of room.participants.values()) {
    latest = Math.max(latest, participant.presence.lastSeenAt);
  }
  return Math.min(
    room.createdAt + ABSOLUTE_ROOM_TTL_MS,
    latest + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS,
  );
}

export interface RoomRepository {
  /** Atomically create the room if the code is unused. False on collision. */
  create(room: Room): Promise<boolean>;
  /** Read-only. Never extends expiry. Null when the room is missing/expired. */
  get(code: string): Promise<Room | null>;
  /**
   * Run `operation` atomically for the room under the per-room distributed
   * lock. Returns null when the room is missing. On success the room version
   * is incremented and the key is written with the recomputed expiry.
   */
  mutate<T>(code: string, operation: (room: Room) => T | Promise<T>): Promise<T | null>;
  /** Delete the room immediately. */
  delete(code: string): Promise<void>;
}

/** Bounded lock acquisition failed — callers should surface a retryable error. */
export class LockTimeoutError extends Error {
  constructor() {
    super("room lock acquisition timed out");
    this.name = "LockTimeoutError";
  }
}

export const LOCK_TTL_MS = 5_000;
export const LOCK_ACQUIRE_TIMEOUT_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Atomic compare-and-release: delete the lock only if we own it. */
export const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

/**
 * The minimal Redis surface used by the repository and rate limiter.
 * Production uses `@upstash/redis`; tests inject a fake implementation.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    opts?: { nx?: boolean; px?: number; pxat?: number },
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T>;
}

export class MemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, { room: Room; expiresAt: number }>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  /** Test/introspection helper: the computed expiry for a code, if present. */
  expiryOf(code: string): number | undefined {
    return this.rooms.get(roomKey(code))?.expiresAt;
  }

  private pruneIfExpired(key: string): boolean {
    const entry = this.rooms.get(key);
    if (entry === undefined) return false;
    if (entry.expiresAt <= this.now()) {
      this.rooms.delete(key);
      return false;
    }
    return true;
  }

  async create(room: Room): Promise<boolean> {
    const key = roomKey(room.code);
    if (this.rooms.has(key)) return false;
    this.rooms.set(key, { room, expiresAt: roomExpiresAt(room) });
    return true;
  }

  async get(code: string): Promise<Room | null> {
    const key = roomKey(code);
    if (!this.pruneIfExpired(key)) return null;
    return this.rooms.get(key)!.room;
  }

  async mutate<T>(code: string, operation: (room: Room) => T | Promise<T>): Promise<T | null> {
    const key = roomKey(code);
    if (!this.pruneIfExpired(key)) return null;
    const entry = this.rooms.get(key)!;
    const result = await operation(entry.room);
    entry.room.version += 1;
    entry.expiresAt = roomExpiresAt(entry.room);
    return result;
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(roomKey(code));
  }
}

export class RedisRoomRepository implements RoomRepository {
  private readonly redis: RedisLike;
  private readonly now: () => number;

  constructor(redis: RedisLike, now: () => number = Date.now) {
    this.redis = redis;
    this.now = now;
  }

  async create(room: Room): Promise<boolean> {
    const result = await this.redis.set(
      roomKey(room.code),
      JSON.stringify(serializeRoom(room)),
      { nx: true, pxat: roomExpiresAt(room) },
    );
    return result === "OK";
  }

  async get(code: string): Promise<Room | null> {
    const raw = await this.redis.get(roomKey(code));
    if (raw === null) return null;
    return deserializeRoom(JSON.parse(raw) as ReturnType<typeof serializeRoom>);
  }

  async mutate<T>(code: string, operation: (room: Room) => T | Promise<T>): Promise<T | null> {
    const token = await this.acquireLock(code);
    try {
      const raw = await this.redis.get(roomKey(code));
      if (raw === null) return null;
      const room = deserializeRoom(JSON.parse(raw) as ReturnType<typeof serializeRoom>);
      const result = await operation(room);
      room.version += 1;
      await this.redis.set(roomKey(code), JSON.stringify(serializeRoom(room)), {
        pxat: roomExpiresAt(room),
      });
      return result;
    } finally {
      await this.releaseLock(code, token);
    }
  }

  async delete(code: string): Promise<void> {
    const token = await this.acquireLock(code);
    try {
      await this.redis.del(roomKey(code));
    } finally {
      await this.releaseLock(code, token);
    }
  }

  private async acquireLock(code: string): Promise<string> {
    const token = randomToken(16);
    const deadline = this.now() + LOCK_ACQUIRE_TIMEOUT_MS;
    for (;;) {
      const acquired = await this.redis.set(lockKey(code), token, { nx: true, px: LOCK_TTL_MS });
      if (acquired === "OK") return token;
      if (this.now() >= deadline) throw new LockTimeoutError();
      await sleep(40 + Math.random() * 60); // 40–100 ms jittered retry
    }
  }

  private async releaseLock(code: string, token: string): Promise<void> {
    await this.redis.eval<number>(RELEASE_LOCK_SCRIPT, [lockKey(code)], [token]);
  }
}
