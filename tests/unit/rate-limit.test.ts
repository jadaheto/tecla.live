import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeRateLimit,
  rateLimitHeaders,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimitsForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T02:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimitsForTests();
});

describe("rate limiter", () => {
  it("allows requests up to the limit and rejects the next", () => {
    expect(consumeRateLimit("guest:1", 2, 60_000).ok).toBe(true);
    expect(consumeRateLimit("guest:1", 2, 60_000).ok).toBe(true);
    const blocked = consumeRateLimit("guest:1", 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps buckets isolated by key", () => {
    consumeRateLimit("a", 1, 60_000);
    expect(consumeRateLimit("a", 1, 60_000).ok).toBe(false);
    expect(consumeRateLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("frees slots after the window elapses", () => {
    consumeRateLimit("window", 1, 10_000);
    expect(consumeRateLimit("window", 1, 10_000).ok).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect(consumeRateLimit("window", 1, 10_000).ok).toBe(true);
  });

  it("emits standard rate limit headers", () => {
    const result = consumeRateLimit("headers", 5, 60_000);
    const headers = rateLimitHeaders(result) as Record<string, string>;
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("4");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
  });
});
