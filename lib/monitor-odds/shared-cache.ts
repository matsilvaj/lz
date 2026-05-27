import "server-only";

import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

export function getMonitorOddsRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  redisClient = url && token ? new Redis({ url, token }) : null;

  return redisClient;
}

export async function readMonitorOddsCache<T>(key: string) {
  const redis = getMonitorOddsRedisClient();

  if (!redis) {
    return null;
  }

  try {
    return await redis.get<T>(key);
  } catch (error) {
    console.warn("Monitor odds shared cache read failed.", { key, error });
    return null;
  }
}

export async function writeMonitorOddsCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
) {
  const redis = getMonitorOddsRedisClient();

  if (!redis) {
    return false;
  }

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return true;
  } catch (error) {
    console.warn("Monitor odds shared cache write failed.", { key, error });
    return false;
  }
}

export async function acquireMonitorOddsLock(key: string, ttlSeconds: number) {
  const redis = getMonitorOddsRedisClient();

  if (!redis) {
    return false;
  }

  try {
    const token = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const result = await redis.set(key, token, { ex: ttlSeconds, nx: true });
    return result === "OK";
  } catch (error) {
    console.warn("Monitor odds shared cache lock failed.", { key, error });
    return false;
  }
}
