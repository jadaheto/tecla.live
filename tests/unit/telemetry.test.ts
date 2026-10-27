import { describe, expect, it } from "vitest";
import type { DriveFix } from "@/features/drive/drive-geolocation";
import {
  averageKmh,
  bearingDegrees,
  compassLabel,
  createLaunch,
  createTrip,
  formatDistance,
  formatElapsed,
  formatLaunch,
  launchStep,
  updateTrip,
  type LaunchState,
} from "@/features/drive/telemetry";

function fix(overrides: Partial<DriveFix> & { timestamp: number }): DriveFix {
  return { latitude: 9.3047, longitude: -75.3978, accuracy: 8, speed: null, heading: null, altitude: null, ...overrides };
}

describe("telemetría de Drive", () => {
  it("derives the bearing between two fixes", () => {
    const origin = { latitude: 9.3047, longitude: -75.3978 };
    expect(Math.round(bearingDegrees(origin, { latitude: 9.3057, longitude: -75.3978 }))).toBe(0);
    expect(Math.round(bearingDegrees(origin, { latitude: 9.3047, longitude: -75.3968 }))).toBe(90);
    expect(Math.round(bearingDegrees(origin, { latitude: 9.3037, longitude: -75.3978 }))).toBe(180);
    expect(compassLabel(bearingDegrees(origin, { latitude: 9.3047, longitude: -75.3988 }))).toBe("O");
  });

  it("names the compass points", () => {
    expect(compassLabel(null)).toBe("—");
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(44)).toBe("NE");
    expect(compassLabel(180)).toBe("S");
    expect(compassLabel(270)).toBe("O");
    expect(compassLabel(359)).toBe("N");
    expect(compassLabel(-90)).toBe("O");
  });

  it("accumulates distance, moving time and the average only while moving", () => {
    let trip = createTrip();
    trip = updateTrip(trip, fix({ timestamp: 0 }), 0);
    trip = updateTrip(trip, fix({ timestamp: 10_000, latitude: 9.3057 }), 40);
    trip = updateTrip(trip, fix({ timestamp: 20_000, latitude: 9.3067 }), 60);
    trip = updateTrip(trip, fix({ timestamp: 30_000, latitude: 9.3067 }), 0);
    expect(trip.distanceM).toBeGreaterThan(200);
    expect(trip.distanceM).toBeLessThan(240);
    expect(trip.movingSeconds).toBe(20);
    expect(trip.maxKmh).toBe(60);
    expect(averageKmh(trip)).toBe(50);
  });

  it("ignores GPS jumps and bad accuracy when summing distance", () => {
    let trip = createTrip();
    trip = updateTrip(trip, fix({ timestamp: 0 }), 50);
    trip = updateTrip(trip, fix({ timestamp: 5_000, latitude: 9.4 }), 50);
    expect(trip.distanceM).toBe(0);
    trip = updateTrip(trip, fix({ timestamp: 10_000, latitude: 9.4005, accuracy: 120 }), 50);
    expect(trip.distanceM).toBe(0);
    expect(trip.movingSeconds).toBe(10);
  });

  it("times a 0–100 launch: arms when still, starts on movement, finishes at 100", () => {
    let state: LaunchState = createLaunch();
    state = launchStep(state, 0, 0, 0.5);
    expect(state.phase).toBe("waiting");
    state = launchStep(state, 0, 500, 0.6);
    expect(state.phase).toBe("armed");
    state = launchStep(state, 0.5, 1_000, 0.1);
    expect(state.phase).toBe("armed");
    state = launchStep(state, 3, 2_000, 0.1);
    expect(state).toMatchObject({ phase: "running", startedAt: 2_000 });
    state = launchStep(state, 60, 4_000, 0.1);
    expect(state.phase).toBe("running");
    expect(state.elapsedMs).toBe(2_000);
    state = launchStep(state, 101, 6_400, 0.1);
    expect(state).toMatchObject({ phase: "done", resultMs: 4_400 });
    expect(formatLaunch(state.resultMs)).toBe("4.40 s");
    // Tras una marca, detenerse vuelve a armar y conserva el resultado hasta la próxima salida.
    state = launchStep(state, 0, 7_000, 1.2);
    expect(state).toMatchObject({ phase: "armed", resultMs: 4_400 });
  });

  it("aborts a launch when the car stops before the target or takes too long", () => {
    let state: LaunchState = { phase: "running", startedAt: 0, resultMs: null, stillSeconds: 0, elapsedMs: 0 };
    state = launchStep(state, 0, 2_000, 0.1);
    expect(state.phase).toBe("aborted");
    state = launchStep({ phase: "running", startedAt: 0, resultMs: null, stillSeconds: 0, elapsedMs: 0 }, 50, 41_000, 0.1);
    expect(state.phase).toBe("aborted");
  });

  it("formats distances and elapsed time", () => {
    expect(formatDistance(420)).toBe("420 m");
    expect(formatDistance(4_250)).toBe("4.3 km");
    expect(formatDistance(42_500)).toBe("43 km");
    expect(formatDistance(16_100, false)).toBe("10 mi");
    expect(formatDistance(8_047, false)).toBe("5.0 mi");
    expect(formatElapsed(65)).toBe("1:05");
    expect(formatElapsed(3_725)).toBe("1:02:05");
    expect(formatLaunch(null)).toBe("—");
  });
});
