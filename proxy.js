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

// ── Upstash REST-backed rate limiting ───────────────────────────────────────
// Uses direct REST commands so middleware remains Edge-compatible.

let _upstash = undefined; // undefined = not yet checked, null = not configured

function getUpstashConfig() {
  if (_upstash !== undefined) return _upstash;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _upstash = {
      url: url.replace(/\/+$/, ''),
      token,
    };
  } else {
    _upstash = null;
  }
  return _upstash;
}

async function upstashCommand(command) {
  const cfg = getUpstashConfig();
  if (!cfg) return null;
  try {
    const response = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

async function getTimestampsFromKV(ip) {
  const key = `ratelimit:${ip}`;
  const raw = await upstashCommand(['GET', key]);
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setTimestampsToKV(ip, timestamps) {
  const key = `ratelimit:${ip}`;
  await upstashCommand(['SET', key, JSON.stringify(timestamps), 'EX', '3600']);
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

export async function proxy(request) {
  // Only rate-limit POST requests to /api/*.
  if (request.method !== 'POST') return NextResponse.next();

  const now = Date.now();
  const ip = getClientIp(request);
  const upstash = getUpstashConfig();

  // ── KV-backed path ───────────────────────────────────────────────────
  if (upstash) {
    let timestamps = await getTimestampsFromKV(ip);
    // Prune timestamps older than 1 hour.
    timestamps = timestamps.filter((ts) => ts > now - HOUR_MS);

    const check = checkLimits(timestamps, now);
    if (check.limited) return rateLimitResponse(check);

    timestamps.push(now);
    // Fire-and-forget — don't block the request on the KV write.
    setTimestampsToKV(ip, timestamps);

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
