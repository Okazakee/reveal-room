import { describe, expect, it } from "vitest";
import {
  LockTimeoutError,
  RELEASE_LOCK_SCRIPT,
  RedisRoomRepository,
  roomKey,
  lockKey,
} from "@/lib/runtime/room-repository";
import type { RedisLike } from "@/lib/runtime/room-repository";
import { RedisRateLimiter } from "@/lib/runtime/rate-limit";
import { MemoryRateLimiter } from "@/lib/runtime/rate-limit";
import type { Room } from "@/lib/types";

/**
 * In-memory Redis stand-in covering exactly the command surface the
 * repository/limiter use (get/set/del/incr/expire/eval with the release
 * script). Distributed-lock semantics (NX, PX, PXAT, compare-and-release)
 * are implemented faithfully so the tests exercise the real logic.
 */
class FakeRedis implements RedisLike {
  readonly store = new Map<string, string>();
  private readonly expiry = new Map<string, number>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private expired(key: string): boolean {
    const at = this.expiry.get(key);
    return at !== undefined && at <= this.now();
  }

  private prune(key: string): void {
    if (this.expired(key)) {
      this.store.delete(key);
      this.expiry.delete(key);
    }
  }

  ttlOf(key: string): number | undefined {
    const at = this.expiry.get(key);
    return at === undefined ? undefined : at - this.now();
  }

  async get(key: string): Promise<string | null> {
    this.prune(key);
    return this.store.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    opts?: { nx?: boolean; px?: number; pxat?: number },
  ): Promise<"OK" | null> {
    this.prune(key);
    if (opts?.nx === true && this.store.has(key)) return null;
    this.store.set(key, value);
    if (opts?.px !== undefined) this.expiry.set(key, this.now() + opts.px);
    if (opts?.pxat !== undefined) this.expiry.set(key, opts.pxat);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      this.prune(key);
      if (this.store.delete(key)) count += 1;
      this.expiry.delete(key);
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    this.prune(key);
    const next = Number(this.store.get(key) ?? "0") + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.expiry.set(key, this.now() + seconds * 1000);
    return 1;
  }

  async eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T> {
    if (script.trim() !== RELEASE_LOCK_SCRIPT.trim()) {
      throw new Error(`fake redis: unhandled script: ${script.slice(0, 60)}`);
    }
    const [key] = keys;
    const [token] = args;
    if (this.store.get(key) === token) {
      this.store.delete(key);
      this.expiry.delete(key);
      return 1 as T;
    }
    return 0 as T;
  }
}

function makeRoom(code: string): Room {
  const now = Date.now();
  return {
    version: 1,
    code,
    title: "t",
    secret: "SECRET",
    locale: "en",
    gameMode: "solo",
    revealMode: "progressive",
    challengeCount: 3,
    status: "lobby",
    hostTokenHash: "hash",
    hostPresence: { lastSeenAt: now },
    participants: new Map(),
    challengeHistory: [],
    revealOrder: [],
    revealedMaskableCount: 0,
    createdAt: now,
    usedTypes: [],
  };
}

describe("RedisRoomRepository distributed state (v1.2)", () => {
  it("create is atomic: a second create with the same code is rejected", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    const room = makeRoom("K7P4XM");

    expect(await repo.create(room)).toBe(true);
    expect(await repo.create(room)).toBe(false);
    expect((await repo.get("K7P4XM"))?.code).toBe("K7P4XM");
  });

  it("create writes the room with the computed expiry (pxat)", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    const room = makeRoom("ABC234");
    await repo.create(room);
    const ttl = redis.ttlOf(roomKey("ABC234"))!;
    // Allow sub-millisecond drift between room creation and the assertion.
    expect(ttl).toBeGreaterThan(344_000);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("mutate reads, applies the operation, bumps version, and rewrites expiry", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    const room = makeRoom("DEF567");
    await repo.create(room);

    const result = await repo.mutate("DEF567", (r) => {
      r.title = "renamed";
      return r.title;
    });
    expect(result).toBe("renamed");

    const stored = await repo.get("DEF567");
    expect(stored?.title).toBe("renamed");
    expect(stored?.version).toBe(2);
    // Lock released: no leftover lock key.
    expect(redis.store.has(lockKey("DEF567"))).toBe(false);
  });

  it("mutate on a missing room returns null without side effects", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    expect(await repo.mutate("ZZZZZZ", (r) => r.title)).toBe(null);
    expect(redis.store.has(lockKey("ZZZZZZ"))).toBe(false);
  });

  it("two competing mutations do not lose each other's state", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    const room = makeRoom("GHI890");
    await repo.create(room);

    await Promise.all([
      repo.mutate("GHI890", (r) => {
        r.participants.set("a", {
          id: "a",
          tokenHash: "h1",
          displayName: "A",
          role: "player",
          joinedAt: Date.now(),
          presence: { lastSeenAt: Date.now() },
          assignedCount: 0,
          completedCount: 0,
        });
        return true;
      }),
      repo.mutate("GHI890", (r) => {
        r.participants.set("b", {
          id: "b",
          tokenHash: "h2",
          displayName: "B",
          role: "player",
          joinedAt: Date.now(),
          presence: { lastSeenAt: Date.now() },
          assignedCount: 0,
          completedCount: 0,
        });
        return true;
      }),
    ]);

    const stored = (await repo.get("GHI890"))!;
    expect(stored.participants.size).toBe(2); // no lost update
    expect(stored.participants.has("a")).toBe(true);
    expect(stored.participants.has("b")).toBe(true);
    expect(stored.version).toBe(3); // create + 2 mutations
  });

  it("releases the lock only when the token matches (compare-and-release)", async () => {
    const redis = new FakeRedis();
    await redis.set(lockKey("LOCK1"), "mine", { nx: true, px: 5000 });

    // Wrong token: lock stays.
    expect(await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey("LOCK1")], ["theirs"])).toBe(0);
    expect(redis.store.has(lockKey("LOCK1"))).toBe(true);

    // Right token: lock released.
    expect(await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey("LOCK1")], ["mine"])).toBe(1);
    expect(redis.store.has(lockKey("LOCK1"))).toBe(false);
  });

  it("lock acquisition times out with a controlled error when held", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis, Date.now);
    // Hold the room lock with a foreign token.
    await redis.set(lockKey("HELD11"), "someone-else", { nx: true, px: 60_000 });
    await expect(repo.mutate("HELD11", (r) => r.title)).rejects.toBeInstanceOf(LockTimeoutError);
    // The foreign lock must survive (not released by our failed attempt).
    expect(redis.store.get(lockKey("HELD11"))).toBe("someone-else");
  });

  it("delete removes the room immediately", async () => {
    const redis = new FakeRedis();
    const repo = new RedisRoomRepository(redis);
    const room = makeRoom("JKL012");
    await repo.create(room);
    await repo.delete("JKL012");
    expect(await repo.get("JKL012")).toBe(null);
    expect(redis.store.has(lockKey("JKL012"))).toBe(false);
  });
});

describe("Redis rate limiter (v1.2)", () => {
  it("enforces the fixed-window limit and expires the counter", async () => {
    const redis = new FakeRedis();
    const limiter = new RedisRateLimiter(redis);
    const allowed = [];
    for (let i = 0; i < 5; i++) {
      allowed.push(await limiter.allow("join", "ip-1", 3, 60_000));
    }
    expect(allowed).toEqual([true, true, true, false, false]);
    expect(redis.ttlOf("rr:rate:join:ip-1")).toBeGreaterThan(0);
  });

  it("isolates different buckets and identifiers", async () => {
    const redis = new FakeRedis();
    const limiter = new RedisRateLimiter(redis);
    expect(await limiter.allow("create", "ip-1", 1, 60_000)).toBe(true);
    expect(await limiter.allow("create", "ip-1", 1, 60_000)).toBe(false);
    expect(await limiter.allow("create", "ip-2", 1, 60_000)).toBe(true);
    expect(await limiter.allow("join", "ip-1", 1, 60_000)).toBe(true);
    expect(await limiter.allow("answer", "player-a", 2, 60_000)).toBe(true);
    expect(await limiter.allow("answer", "player-b", 2, 60_000)).toBe(true);
  });
});

describe("MemoryRateLimiter (dev/test)", () => {
  it("allows up to the limit and resets after the window", async () => {
    const clock = { value: 0, now: () => clock.value };
    const limiter = new MemoryRateLimiter(clock.now);
    expect(await limiter.allow("create", "ip", 2, 1000)).toBe(true);
    expect(await limiter.allow("create", "ip", 2, 1000)).toBe(true);
    expect(await limiter.allow("create", "ip", 2, 1000)).toBe(false);
    clock.value = 1001;
    expect(await limiter.allow("create", "ip", 2, 1000)).toBe(true);
  });
});
