import { describe, expect, it } from "vitest";
import { estimateProgressMs } from "@/features/music/now-playing";

describe("estimateProgressMs", () => {
  it("adds the elapsed time while playing", () => {
    expect(estimateProgressMs({ playing: true, progressMs: 10_000, durationMs: 200_000 }, 1_000, 4_500)).toBe(13_500);
  });

  it("keeps the last position while paused", () => {
    expect(estimateProgressMs({ playing: false, progressMs: 10_000, durationMs: 200_000 }, 1_000, 4_500)).toBe(10_000);
  });

  it("never passes the duration nor goes backwards", () => {
    expect(estimateProgressMs({ playing: true, progressMs: 199_000, durationMs: 200_000 }, 0, 5_000)).toBe(200_000);
    expect(estimateProgressMs({ playing: true, progressMs: 5_000, durationMs: 200_000 }, 9_000, 4_000)).toBe(5_000);
  });
});
