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
