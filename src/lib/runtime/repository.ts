import { Redis } from "@upstash/redis";
import { MemoryRateLimiter, RedisRateLimiter } from "@/lib/runtime/rate-limit";
import type { RateLimiter } from "@/lib/runtime/rate-limit";
import {
  MemoryRoomRepository,
  RedisRoomRepository,
} from "@/lib/runtime/room-repository";
import type { RedisLike, RoomRepository } from "@/lib/runtime/room-repository";

/**
 * Repository / limiter selection (spec v1.2 §10.2).
 *
 * Policy:
 *   NODE_ENV=test                          → memory
 *   development + USE_MEMORY_STORE=true    → memory
 *   otherwise (including all Vercel environments) → Redis REQUIRED
 *
 * Missing Redis configuration in production is a configuration error — the
 * app must never silently fall back to memory.
 */

export type StoreMode = "memory" | "redis";

export function resolveStoreMode(): StoreMode {
  if (process.env.NODE_ENV === "test") return "memory";
  if (process.env.NODE_ENV !== "production" && process.env.USE_MEMORY_STORE === "true") {
    return "memory";
  }
  return "redis";
}

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient !== null) return redisClient;
  // Accept both the standard Upstash naming and the KV-style naming emitted
  // by the Vercel Marketplace Upstash integration.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url === undefined || token === undefined || url.length === 0 || token.length === 0) {
    throw new Error(
      "Missing Upstash Redis configuration: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/KV_REST_API_TOKEN) must be set (server-side only).",
    );
  }
  redisClient = new Redis({
    url,
    token,
    // Keep raw string values: the repository explicitly JSON-encodes and
    // decodes whole-room documents; the client must not double-parse.
    automaticDeserialization: false,
  });
  return redisClient;
}

// Shared memory instances so development requests see each other's rooms.
const sharedMemoryRepository = new MemoryRoomRepository();
const sharedMemoryRateLimiter = new MemoryRateLimiter();

export function getRoomRepository(): RoomRepository {
  if (resolveStoreMode() === "memory") return sharedMemoryRepository;
  return new RedisRoomRepository(getRedis() as unknown as RedisLike);
}

export function getRateLimiter(): RateLimiter {
  if (resolveStoreMode() === "memory") return sharedMemoryRateLimiter;
  return new RedisRateLimiter(getRedis() as unknown as RedisLike);
}
