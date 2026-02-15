import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Rate-limiting middleware (IP-based sliding window, KV-backed)
// ---------------------------------------------------------------------------
// Limits:
//   • 20 requests per minute per IP   (burst protection)
//   • 100 requests per hour per IP    (sustained abuse protection)
//
// Uses Upstash Redis when UPSTASH_REDIS_REST_URL + TOKEN are configured.
// Falls back to in-memory Map (resets on cold starts) otherwise.
// ---------------------------------------------------------------------------

const MINUTE_LIMIT = 20;
const HOUR_LIMIT = 100;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const CLEANUP_INTERVAL_MS = 5 * MINUTE_MS;

// ── In-memory fallback (used when Redis is not configured) ──────────────────

/** @type {Map<string, { timestamps: number[] }>} */
const windowMap = new Map();
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - HOUR_MS;
  for (const [ip, entry] of windowMap) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
    if (entry.timestamps.length === 0) windowMap.delete(ip);
  }
}

// ── Redis-backed rate limiting ──────────────────────────────────────────────
// We dynamically import @upstash/redis only when env vars are present
// to keep the middleware edge-compatible and avoid import errors.

let _redis = undefined; // undefined = not yet checked, null = not configured

async function getRedis() {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const { Redis } = await import('@upstash/redis');
      _redis = new Redis({ url, token });
    } catch {
      _redis = null;
    }
  } else {
    _redis = null;
  }
  return _redis;
}

async function getTimestampsFromKV(redis, ip) {
  try {
    const key = `ratelimit:${ip}`;
    const data = await redis.get(key);
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

async function setTimestampsToKV(redis, ip, timestamps) {
  try {
    const key = `ratelimit:${ip}`;
    await redis.set(key, timestamps, { ex: 3600 }); // TTL = 1 hour
  } catch {
    // Non-critical — fall through to in-memory.
  }
}

// ── Shared logic ────────────────────────────────────────────────────────────

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function checkLimits(timestamps, now) {
  const recentMinute = timestamps.filter((ts) => ts > now - MINUTE_MS).length;
  if (recentMinute >= MINUTE_LIMIT) {
    return { limited: true, retryAfterSec: 60, reason: 'minute' };
  }
  const recentHour = timestamps.filter((ts) => ts > now - HOUR_MS).length;
  if (recentHour >= HOUR_LIMIT) {
    return { limited: true, retryAfterSec: 600, reason: 'hour' };
  }
  return { limited: false };
}

function rateLimitResponse(check) {
  return NextResponse.json(
    {
      error: 'Too many requests. Please wait a moment and try again.',
      retryAfterSeconds: check.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(check.retryAfterSec),
        'X-RateLimit-Limit-Minute': String(MINUTE_LIMIT),
        'X-RateLimit-Limit-Hour': String(HOUR_LIMIT),
      },
    }
  );
}

// ── Middleware entry point ──────────────────────────────────────────────────

export async function middleware(request) {
  // Only rate-limit POST requests to /api/*.
  if (request.method !== 'POST') return NextResponse.next();

  const now = Date.now();
  const ip = getClientIp(request);
  const redis = await getRedis();

  // ── KV-backed path ───────────────────────────────────────────────────
  if (redis) {
    let timestamps = await getTimestampsFromKV(redis, ip);
    // Prune timestamps older than 1 hour.
    timestamps = timestamps.filter((ts) => ts > now - HOUR_MS);

    const check = checkLimits(timestamps, now);
    if (check.limited) return rateLimitResponse(check);

    timestamps.push(now);
    // Fire-and-forget — don't block the request on the KV write.
    setTimestampsToKV(redis, ip, timestamps);

    const response = NextResponse.next();
    const remainMin = MINUTE_LIMIT - timestamps.filter((ts) => ts > now - MINUTE_MS).length;
    const remainHr = HOUR_LIMIT - timestamps.filter((ts) => ts > now - HOUR_MS).length;
    response.headers.set('X-RateLimit-Remaining-Minute', String(Math.max(0, remainMin)));
    response.headers.set('X-RateLimit-Remaining-Hour', String(Math.max(0, remainHr)));
    return response;
  }

  // ── In-memory fallback path ──────────────────────────────────────────
  cleanupStaleEntries();

  let entry = windowMap.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    windowMap.set(ip, entry);
  }
  entry.timestamps = entry.timestamps.filter((ts) => ts > now - HOUR_MS);

  const check = checkLimits(entry.timestamps, now);
  if (check.limited) return rateLimitResponse(check);

  entry.timestamps.push(now);

  const remainMin = MINUTE_LIMIT - entry.timestamps.filter((ts) => ts > now - MINUTE_MS).length;
  const remainHr = HOUR_LIMIT - entry.timestamps.filter((ts) => ts > now - HOUR_MS).length;
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining-Minute', String(Math.max(0, remainMin)));
  response.headers.set('X-RateLimit-Remaining-Hour', String(Math.max(0, remainHr)));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
