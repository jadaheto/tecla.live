import { describe, expect, it } from "vitest";
import { ambientDrift, formatAmbientTime, shouldAutoAmbient } from "@/features/ambient/ambient-rules";

const base = { idleMinutes: 10, idleMs: 11 * 60_000, pathname: "/", videoOnScreen: false, assistantOpen: false, overlayOpen: false };

describe("pantalla ambiente", () => {
  it("opens only after the idle time on a quiet screen", () => {
    expect(shouldAutoAmbient(base)).toBe(true);
    expect(shouldAutoAmbient({ ...base, idleMs: 9 * 60_000 })).toBe(false);
    expect(shouldAutoAmbient({ ...base, idleMinutes: 0 })).toBe(false);
  });

  it("never covers a video, Drive, the remote page or an open assistant", () => {
    expect(shouldAutoAmbient({ ...base, pathname: "/drive" })).toBe(false);
    expect(shouldAutoAmbient({ ...base, pathname: "/watch/abc123" })).toBe(false);
    expect(shouldAutoAmbient({ ...base, pathname: "/remote/ABCDEF" })).toBe(false);
    expect(shouldAutoAmbient({ ...base, videoOnScreen: true })).toBe(false);
    expect(shouldAutoAmbient({ ...base, assistantOpen: true })).toBe(false);
    expect(shouldAutoAmbient({ ...base, overlayOpen: true })).toBe(false);
    expect(shouldAutoAmbient({ ...base, pathname: "/music" })).toBe(true);
  });

  it("drifts the content within a small radius to protect the screen", () => {
    const seen = new Set<string>();
    for (let minute = 0; minute < 12; minute += 1) {
      const drift = ambientDrift(minute);
      expect(Math.abs(drift.x)).toBeLessThanOrEqual(28);
      expect(Math.abs(drift.y)).toBeLessThanOrEqual(28);
      seen.add(`${drift.x},${drift.y}`);
    }
    expect(seen.size).toBeGreaterThan(6);
    expect(ambientDrift(3)).toEqual(ambientDrift(15));
  });

  it("formats the clock in Bogotá time", () => {
    const clock = formatAmbientTime(new Date("2026-10-27T18:05:09Z"));
    expect(clock.time).toBe("13:05");
    expect(clock.seconds).toBe("09");
    expect(clock.date).toContain("octubre");
  });
});
