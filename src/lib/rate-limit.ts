interface Bucket {
  timestamps: number[];
}

interface RateLimitStore {
  buckets: Map<string, Bucket>;
  lastSweep: number;
}

const globalStore = globalThis as unknown as { __teclaRateLimits?: RateLimitStore };

function store(): RateLimitStore {
  if (!globalStore.__teclaRateLimits) {
    globalStore.__teclaRateLimits = { buckets: new Map(), lastSweep: Date.now() };
  }
  return globalStore.__teclaRateLimits;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Límite de ventana deslizante en memoria, suficiente para una instancia.
 * En producción con varias réplicas debe migrarse a PostgreSQL o Redis.
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const state = store();

  if (now - state.lastSweep > 60_000) {
    for (const [bucketKey, bucket] of state.buckets) {
      const alive = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (alive.length === 0) state.buckets.delete(bucketKey);
      else bucket.timestamps = alive;
    }
    state.lastSweep = now;
  }

  const bucket = state.buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);
  const resetAt = (bucket.timestamps[0] ?? now) + windowMs;

  if (bucket.timestamps.length >= limit) {
    state.buckets.set(key, bucket);
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  state.buckets.set(key, bucket);
  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    resetAt,
    retryAfterSeconds: 0,
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export function resetRateLimitsForTests() {
  store().buckets.clear();
}
