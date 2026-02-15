// ---------------------------------------------------------------------------
// KV store abstraction — Upstash Redis with in-memory fallback
// ---------------------------------------------------------------------------
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured,
// all cache/health data persists across serverless cold starts.
//
// When those env vars are missing (e.g. local dev), falls back to an
// in-memory Map so the app works identically without Redis.
// ---------------------------------------------------------------------------

import { Redis } from '@upstash/redis';

// ── Redis client (or null if not configured) ────────────────────────────────

let redis = null;

function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
  }
  return redis;
}

// ── In-memory fallback ──────────────────────────────────────────────────────

const memStore = new Map();

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
  // Cap in-memory entries to avoid unbounded growth.
  if (memStore.size > 1000) {
    const oldest = memStore.keys().next().value;
    if (oldest) memStore.delete(oldest);
  }
}

function memDel(key) {
  memStore.delete(key);
}
export async function kvIncr(key) {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      // Fallback to memory if Redis fails temporarily?
      // For a counter, maybe just ignore or return safe default.
    }
  }
  
  // In-memory fallback
  const currentEntry = memStore.get(key);
  const current = currentEntry ? Number(currentEntry.value) : 0;
  const next = current + 1;
  memSet(key, next, 0);
  return next;
}
// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a JSON value by key. Returns null if not found or expired.
 */
export async function kvGet(key) {
  const client = getRedis();
  if (client) {
    try {
      const value = await client.get(key);
      return value ?? null;
    } catch {
      // Redis unavailable — fall back to memory.
      return memGet(key);
    }
  }
  return memGet(key);
}

/**
 * Set a JSON value with an optional TTL in seconds.
 */
export async function kvSet(key, value, ttlSeconds = 0) {
  const client = getRedis();
  if (client) {
    try {
      if (ttlSeconds > 0) {
        await client.set(key, value, { ex: ttlSeconds });
      } else {
        await client.set(key, value);
      }
      return;
    } catch {
      // Redis unavailable — fall back to memory.
    }
  }
  memSet(key, value, ttlSeconds || null);
}

/**
 * Delete a key.
 */
export async function kvDel(key) {
  const client = getRedis();
  if (client) {
    try {
      await client.del(key);
      return;
    } catch {
      // fall through
    }
  }
  memDel(key);
}

/**
 * Returns true if the KV store is backed by Redis (persistent).
 */
export function isRedisBacked() {
  return getRedis() !== null;
}
