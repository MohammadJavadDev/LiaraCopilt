/**
 * Simple in-memory, fixed-window rate limiter (PROJECT_SPEC §10: "20
 * requests/minute/IP, in-memory is enough, no Redis needed"). Module-level
 * state is fine for a single-instance hackathon deployment; it resets on
 * redeploy/restart, which is an acceptable trade-off here.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_TRACKED_KEYS = 5000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

function pruneStaleBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/** `key` is typically the client IP; call once per incoming request. */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();

  // Bound worst-case memory from many distinct IPs (e.g. behind a scraper/botnet) instead of growing forever.
  if (buckets.size > MAX_TRACKED_KEYS) {
    pruneStaleBuckets(now);
  }

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < MAX_REQUESTS_PER_WINDOW) {
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
}
