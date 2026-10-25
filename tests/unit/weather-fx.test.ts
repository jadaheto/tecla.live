import { describe, expect, it } from "vitest";
import { particleCount, weatherFxPreset } from "@/features/weather/fx-presets";

describe("weather effects presets", () => {
  it("maps Open-Meteo codes to the effect kinds", () => {
    expect(weatherFxPreset({ code: 61, isDay: true }).kind).toBe("rain");
    expect(weatherFxPreset({ code: 53, isDay: true }).kind).toBe("rain");
    expect(weatherFxPreset({ code: 95, isDay: false })).toMatchObject({ kind: "storm", flashes: true });
    expect(weatherFxPreset({ code: 73, isDay: true }).kind).toBe("snow");
    expect(weatherFxPreset({ code: 45, isDay: true }).kind).toBe("fog");
    expect(weatherFxPreset({ code: 3, isDay: true }).kind).toBe("clouds");
    expect(weatherFxPreset({ code: 0, isDay: true }).kind).toBe("sun");
    expect(weatherFxPreset({ code: 0, isDay: false }).kind).toBe("stars");
    expect(weatherFxPreset({ code: 999, isDay: true })).toMatchObject({ kind: "none", density: 0 });
  });

  it("scales intensity with the code and tilts rain with the wind", () => {
    const light = weatherFxPreset({ code: 61, isDay: true, windSpeed: 0 });
    const heavy = weatherFxPreset({ code: 82, isDay: true, windSpeed: 40 });
    expect(heavy.density).toBeGreaterThan(light.density);
    expect(light.angle).toBe(0);
    expect(heavy.angle).toBe(18);
    expect(weatherFxPreset({ code: 63, isDay: true, windSpeed: 200 }).angle).toBeLessThanOrEqual(28);
  });

  it("caps the particle count to protect the car's browser", () => {
    const storm = weatherFxPreset({ code: 99, isDay: false });
    expect(particleCount(storm, 1920, 1080, 1)).toBeLessThanOrEqual(900);
    expect(particleCount(storm, 1920, 1080, 0.5)).toBeLessThan(particleCount(storm, 1920, 1080, 1));
    expect(particleCount(weatherFxPreset({ code: 999, isDay: true }), 1920, 1080)).toBe(0);
  });
});
