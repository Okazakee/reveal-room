import type { RedisLike } from "@/lib/runtime/room-repository";

/**
 * Fixed-window rate limiting (spec v1.2 §32 RR-LIMIT-005).
 * Production is Redis-backed (cross-instance consistent); tests and explicit
 * local development modes use the memory implementation.
 */

export const RATE_LIMITS = {
  create: { limit: 10, windowMs: 10 * 60_000 },
  join: { limit: 30, windowMs: 60_000 },
  answer: { limit: 120, windowMs: 60_000 },
} as const;

export interface RateLimiter {
  /** True when the request is allowed and recorded; false when rate-limited. */
  allow(bucket: string, id: string, limit: number, windowMs: number): Promise<boolean>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async allow(bucket: string, id: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `${bucket}:${id}`;
    const now = this.now();
    const existing = this.buckets.get(key);
    if (existing === undefined || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.prune(now);
      return true;
    }
    if (existing.count >= limit) return false;
    existing.count += 1;
    return true;
  }

  /** Drop expired buckets once the map grows beyond a bounded size. */
  private prune(now: number): void {
    if (this.buckets.size <= 4096) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export class RedisRateLimiter implements RateLimiter {
  private readonly redis: RedisLike;

  constructor(redis: RedisLike) {
    this.redis = redis;
  }

  async allow(bucket: string, id: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `rr:rate:${bucket}:${id}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, Math.max(1, Math.ceil(windowMs / 1000)));
    }
    return count <= limit;
  }
}
