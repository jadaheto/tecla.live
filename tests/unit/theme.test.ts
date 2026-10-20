import { describe, expect, it } from "vitest";
import {
  getBogotaMinutes,
  isWithinWindow,
  parseTimeToMinutes,
  resolveTheme,
} from "@/lib/theme";

describe("theme schedule", () => {
  it("parses valid times and rejects invalid ones", () => {
    expect(parseTimeToMinutes("18:30")).toBe(1110);
    expect(parseTimeToMinutes("06:05")).toBe(365);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("9:00")).toBeNull();
    expect(parseTimeToMinutes("noon")).toBeNull();
  });

  it("handles windows that cross midnight", () => {
    expect(isWithinWindow(120, 1110, 390)).toBe(true);
    expect(isWithinWindow(1110, 1110, 390)).toBe(true);
    expect(isWithinWindow(389, 1110, 390)).toBe(true);
    expect(isWithinWindow(390, 1110, 390)).toBe(false);
    expect(isWithinWindow(600, 1110, 390)).toBe(false);
  });

  it("resolves explicit themes without consulting the schedule", () => {
    const now = new Date("2026-10-20T02:00:00.000Z");
    expect(
      resolveTheme({ mode: "light", now, autoEnabled: true, start: "18:30", end: "06:30" }),
    ).toBe("light");
    expect(
      resolveTheme({ mode: "dark", now, autoEnabled: false, start: "00:00", end: "00:00" }),
    ).toBe("dark");
  });

  it("uses dark inside the auto window and light outside", () => {
    const evening = new Date(2026, 9, 19, 21, 0, 0);
    const midday = new Date(2026, 9, 20, 12, 0, 0);
    expect(
      resolveTheme({ mode: "auto", now: evening, autoEnabled: true, start: "18:30", end: "06:30" }),
    ).toBe("dark");
    expect(
      resolveTheme({ mode: "auto", now: midday, autoEnabled: true, start: "18:30", end: "06:30" }),
    ).toBe("light");
  });

  it("returns a valid Bogota minute of day", () => {
    const minutes = getBogotaMinutes(new Date("2026-10-20T02:00:00.000Z"));
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThan(1440);
  });
});
