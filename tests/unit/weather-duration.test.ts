import { describe, expect, it } from "vitest";
import { parseIsoDuration } from "@/lib/duration";
import { describeWeather } from "@/lib/weather-codes";

describe("duration", () => {
  it("parses ISO 8601 YouTube durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P1DT2H")).toBe(93_600);
    expect(parseIsoDuration(undefined)).toBe(0);
    expect(parseIsoDuration("invalid")).toBe(0);
  });
});

describe("weather codes", () => {
  it("maps WMO codes to Spanish descriptions", () => {
    expect(describeWeather(0)).toEqual({ group: "clear", label: "Despejado" });
    expect(describeWeather(95).group).toBe("storm");
    expect(describeWeather(999).group).toBe("unknown");
  });
});
