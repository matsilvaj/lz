import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

type RateLimitOptions = {
  identity?: string;
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const distributedLimiters = new Map<string, Ratelimit>();

let redisClient: Redis | null | undefined;
let memoryOperations = 0;

async function getRequestIdentity() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  redisClient = url && token ? new Redis({ url, token }) : null;

  return redisClient;
}

function getDistributedLimiter(key: string, limit: number, windowMs: number) {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  const limiterKey = `${key}:${limit}:${windowMs}`;
  let limiter = distributedLimiters.get(limiterKey);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        limit,
        `${Math.max(1, Math.ceil(windowMs / 1000))} s`,
      ),
      analytics: false,
      prefix: `lz:${key}`,
    });
    distributedLimiters.set(limiterKey, limiter);
  }

  return limiter;
}

function consumeMemoryRateLimit(bucketKey: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(bucketKey);

  memoryOperations += 1;

  if (memoryOperations % 100 === 0) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

export async function consumeRateLimit({
  identity,
  key,
  limit,
  windowMs,
}: RateLimitOptions) {
  const resolvedIdentity = identity ?? (await getRequestIdentity());
  const distributedLimiter = getDistributedLimiter(key, limit, windowMs);

  if (distributedLimiter) {
    try {
      const result = await distributedLimiter.limit(resolvedIdentity);
      return result.success;
    } catch (error) {
      console.warn("Distributed rate limit failed, falling back to local memory.", {
        key,
        error,
      });
    }
  }

  return consumeMemoryRateLimit(`${key}:${resolvedIdentity}`, limit, windowMs);
}
