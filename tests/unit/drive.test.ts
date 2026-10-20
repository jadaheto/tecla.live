import { describe, expect, it } from "vitest";
import {
  AUTO_TARGET_SPEED,
  DRIVE_SCENES,
  DRIVE_SOUNDS,
  MAX_SPEED,
  findScene,
  findSound,
  formatSpeed,
  speedRatio,
  stepDriveSpeed,
} from "@/features/drive/drive-config";
import { estimateSpeedKmh } from "@/features/drive/drive-geolocation";

describe("TECLA Drive simulation", () => {
  it("auto drive reaches the target and releases autopilot", () => {
    let state = { speed: 0, autoPilot: true };
    for (let index = 0; index < 100; index += 1) {
      state = stepDriveSpeed(
        state.speed,
        { accelerating: false, braking: false, autoPilot: state.autoPilot },
        0.1,
      );
      if (!state.autoPilot) break;
    }
    expect(state.speed).toBe(AUTO_TARGET_SPEED);
    expect(state.autoPilot).toBe(false);
  });

  it("braking clamps at zero and acceleration increases speed", () => {
    let braking = 4;
    for (let index = 0; index < 10; index += 1) {
      braking = stepDriveSpeed(
        braking,
        { accelerating: false, braking: true, autoPilot: false },
        0.1,
      ).speed;
    }
    expect(braking).toBe(0);
    expect(
      stepDriveSpeed(40, { accelerating: true, braking: false, autoPilot: false }, 1).speed,
    ).toBeGreaterThan(40);
  });

  it("never exceeds the simulated maximum", () => {
    const state = stepDriveSpeed(
      MAX_SPEED,
      { accelerating: true, braking: false, autoPilot: false },
      1,
    );
    expect(state.speed).toBe(MAX_SPEED);
    expect(speedRatio(state.speed)).toBe(1);
  });

  it("formats speed and exposes unique scenes and sounds", () => {
    expect(formatSpeed(61.7)).toBe("62");
    expect(new Set(DRIVE_SCENES.map((scene) => scene.id)).size).toBe(DRIVE_SCENES.length);
    expect(new Set(DRIVE_SOUNDS.map((sound) => sound.id)).size).toBe(DRIVE_SOUNDS.length);
    expect(findScene("coast").label).toBe("Costa");
    expect(findSound("warp").label).toBe("Hiperespacio");
  });
});

describe("TECLA Drive GPS helpers", () => {
  it("converts device speed from m/s to km/h and caps it", () => {
    const fix = {
      latitude: 9.3047,
      longitude: -75.3978,
      timestamp: 1_000,
      accuracy: 8,
      speed: 10,
    };
    expect(estimateSpeedKmh(null, fix)).toBe(36);
    expect(estimateSpeedKmh(null, { ...fix, speed: 80 })).toBe(MAX_SPEED);
  });

  it("derives speed from two nearby fixes when the device omits speed", () => {
    const first = {
      latitude: 9.3047,
      longitude: -75.3978,
      timestamp: 1_000,
      accuracy: 8,
      speed: null,
    };
    const second = { ...first, latitude: 9.3048, timestamp: 2_000 };
    const speed = estimateSpeedKmh(first, second);
    expect(speed).not.toBeNull();
    expect(speed).toBeGreaterThan(30);
    expect(speed).toBeLessThan(130);
  });
});
