import { describe, expect, it } from "vitest";
import {
  DRIVE_ENGINES,
  DRIVE_SCENES,
  ENGINE_CATEGORIES,
  LAUNCH_TARGET_SPEED,
  MAX_SPEED,
  filterEngines,
  findEngine,
  findScene,
  formatSpeed,
  rpmNorm,
  speedRatio,
} from "@/features/drive/drive-config";
import {
  GPS_HOLD_SECONDS,
  estimateSpeedKmh,
  headingDelta,
  holdSpeedWhenStale,
  qualityFromAccuracy,
} from "@/features/drive/drive-geolocation";
import { pickAutoScene, isTeslaBrowser } from "@/features/drive/drive-config";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import {
  DEFAULT_INPUTS,
  GEAR_TOP_KMH,
  MAX_GEAR,
  autoShift,
  createDriveState,
  describeDriveState,
  rpmFromSpeed,
  shiftGear,
  stepDrive,
  type DriveSimState,
} from "@/features/drive/engine-model";
import { EngineSynth } from "@/features/drive/engine-synth";

const v8 = findEngine("v8_biturbo");
const ev = findEngine("ev_trimotor");

describe("TECLA Drive catalog", () => {
  it("exposes unique scenes and engines without brand names", () => {
    expect(new Set(DRIVE_SCENES.map((scene) => scene.id)).size).toBe(DRIVE_SCENES.length);
    expect(new Set(DRIVE_ENGINES.map((engine) => engine.id)).size).toBe(DRIVE_ENGINES.length);
    expect(DRIVE_ENGINES.length).toBeGreaterThanOrEqual(20);
    const banned = /ferrari|dodge|hellcat|camaro|mustang|nissan|tesla|plaid|amg|bmw|subaru|mazda/i;
    for (const engine of DRIVE_ENGINES) {
      expect(`${engine.name} ${engine.sub} ${engine.description}`).not.toMatch(banned);
    }
    expect(findScene("coast").label).toBe("Costa");
    expect(findScene("unknown").id).toBe(DRIVE_SCENES[0]?.id);
    expect(findEngine("missing").id).toBe(DRIVE_ENGINES[0]?.id);
  });

  it("filters engines by category and favorites", () => {
    const categories = ENGINE_CATEGORIES.map((category) => category.id);
    expect(categories).toContain("fav");
    expect(filterEngines("all", []).length).toBe(DRIVE_ENGINES.length);
    expect(filterEngines("ev", []).every((engine) => engine.category === "ev")).toBe(true);
    expect(filterEngines("fav", ["v8_biturbo", "warp"]).map((engine) => engine.id)).toEqual([
      "v8_biturbo",
      "warp",
    ]);
  });

  it("formats speed in km/h or mph and caps the gauge", () => {
    expect(formatSpeed(61.7)).toBe("62");
    expect(formatSpeed(100, false)).toBe("62");
    expect(speedRatio(MAX_SPEED * 2)).toBe(1);
    expect(rpmNorm(v8, v8.idle)).toBe(0);
    expect(rpmNorm(v8, v8.redline)).toBe(1);
  });
});

describe("TECLA Drive transmission", () => {
  it("maps speed to rpm per gear and never drops below idle", () => {
    expect(rpmFromSpeed(v8, 0, 1)).toBe(v8.idle);
    expect(rpmFromSpeed(v8, GEAR_TOP_KMH[0] ?? 42, 1)).toBeCloseTo(v8.redline * 0.96, 0);
    expect(rpmFromSpeed(v8, 60, 3)).toBeLessThan(rpmFromSpeed(v8, 60, 2));
    expect(rpmFromSpeed(ev, 250, 1)).toBe(ev.redline);
  });

  it("shifts up near the limiter and down at low rpm", () => {
    const up = autoShift(v8, 41.5, 1, 1);
    expect(up.gear).toBe(2);
    expect(up.shiftedUp).toBe(true);
    const down = autoShift(v8, 5, 3, 0);
    expect(down.gear).toBe(2);
    expect(down.shiftedUp).toBe(false);
    expect(autoShift(ev, 200, 1, 1).gear).toBe(1);
    expect(shiftGear({ ...createDriveState(v8), gear: MAX_GEAR }, 1).gear).toBe(MAX_GEAR);
    expect(shiftGear(createDriveState(v8), -1).gear).toBe(1);
  });

  it("launch mode reaches 0–100 and hands over to cruise with a lift-off", () => {
    let state: DriveSimState = { ...createDriveState(v8), mode: "launch" };
    let liftOffs = 0;
    for (let index = 0; index < 600; index += 1) {
      const result = stepDrive(v8, state, DEFAULT_INPUTS, 1 / 60, () => 0.99);
      state = result.state;
      if (result.events.liftOff) liftOffs += 1;
      if (state.mode === "cruise") break;
    }
    expect(state.mode).toBe("cruise");
    expect(state.speedKmh).toBeGreaterThanOrEqual(LAUNCH_TARGET_SPEED - 0.5);
    expect(state.gear).toBeGreaterThan(1);
    expect(liftOffs).toBeGreaterThan(0);
  });

  it("rev mode bounces on the limiter while the car coasts", () => {
    let state: DriveSimState = { ...createDriveState(v8), mode: "rev", speedKmh: 20 };
    for (let index = 0; index < 120; index += 1) {
      state = stepDrive(v8, state, DEFAULT_INPUTS, 1 / 60, () => 0.99).state;
    }
    expect(state.rpm).toBeGreaterThan(v8.redline * 0.8);
    expect(state.rpm).toBeLessThanOrEqual(v8.redline);
    expect(state.speedKmh).toBeLessThan(20);
  });

  it("gps mode follows the real speed and idle mode decays to a stop", () => {
    let state: DriveSimState = { ...createDriveState(v8), mode: "gps" };
    for (let index = 0; index < 240; index += 1) {
      state = stepDrive(v8, state, { ...DEFAULT_INPUTS, gpsSpeedKmh: 80 }, 1 / 60).state;
    }
    expect(state.speedKmh).toBeGreaterThan(75);
    expect(describeDriveState(state)).toBe("CONDUCIENDO");

    let idle: DriveSimState = { ...state, mode: "idle" };
    for (let index = 0; index < 400; index += 1) {
      idle = stepDrive(v8, idle, DEFAULT_INPUTS, 1 / 60).state;
    }
    expect(idle.speedKmh).toBe(0);
    expect(idle.gear).toBe(1);
    expect(describeDriveState(idle)).toBe("EN REPOSO");
  });

  it("touch pedals accelerate and brake within the gauge limits", () => {
    let state = createDriveState(v8);
    for (let index = 0; index < 180; index += 1) {
      state = stepDrive(v8, state, { ...DEFAULT_INPUTS, accelerating: true }, 1 / 60).state;
    }
    expect(state.speedKmh).toBeGreaterThan(30);
    expect(state.speedKmh).toBeLessThanOrEqual(MAX_SPEED);
    for (let index = 0; index < 180; index += 1) {
      state = stepDrive(v8, state, { ...DEFAULT_INPUTS, braking: true }, 1 / 60).state;
    }
    expect(state.speedKmh).toBe(0);
  });
});

describe("TECLA Drive synth", () => {
  it("renders bounded, non-silent audio for every engine type", () => {
    const seen = new Set<string>();
    for (const engine of DRIVE_ENGINES) {
      if (seen.has(engine.engineType)) continue;
      seen.add(engine.engineType);
      const synth = new EngineSynth(engine, () => 0.5);
      synth.setDrive(engine.idle + (engine.redline - engine.idle) * 0.4, 0.6);
      const out = new Float32Array(4096);
      synth.render(out, 48_000);
      let peak = 0;
      let energy = 0;
      for (const sample of out) {
        expect(Number.isFinite(sample)).toBe(true);
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      expect(peak).toBeLessThanOrEqual(1);
      expect(energy / out.length).toBeGreaterThan(0.0001);
    }
  });
});

describe("TECLA Drive auto scene", () => {
  it("picks scenes by hour and weather deterministically", () => {
    expect(pickAutoScene({ hour: 21, month: 10, weather: null })).toBe("halloween");
    expect(pickAutoScene({ hour: 21, month: 3, weather: null })).toBe("aurora");
    expect(pickAutoScene({ hour: 1, month: 3, weather: null })).toBe("galaxy");
    expect(pickAutoScene({ hour: 18, month: 3, weather: "clear" })).toBe("neon");
    expect(pickAutoScene({ hour: 9, month: 3, weather: "clear" })).toBe("coast");
    expect(pickAutoScene({ hour: 15, month: 3, weather: "clouds" })).toBe("city_day");
    expect(pickAutoScene({ hour: 15, month: 3, weather: "clear" })).toBe("canyon");
    expect(pickAutoScene({ hour: 21, month: 12, weather: null })).toBe("christmas");
    expect(pickAutoScene({ hour: 21, month: 3, weather: "rain" })).toBe("rainy_city");
    expect(pickAutoScene({ hour: 15, month: 3, weather: "rain" })).toBe("alpine");
    expect(pickAutoScene({ hour: 22, month: 3, weather: "storm" })).toBe("halloween");
    expect(pickAutoScene({ hour: 22, month: 3, weather: "fog" })).toBe("aurora");
  });

  it("detects the Tesla browser user agent", () => {
    expect(isTeslaBrowser("Mozilla/5.0 (X11; GNU/Linux) AppleWebKit/537.36 Chrome/120 Safari/537.36 Tesla/2024.8")).toBe(true);
    expect(isTeslaBrowser("Mozilla/5.0 (Macintosh) Chrome/120")).toBe(false);
  });
});

describe("TECLA Drive engine worklet", () => {
  it("matches the TypeScript synth sample for sample", () => {
    const source = readFileSync("public/drive/engine-worklet.js", "utf8");
    let Processor: (new () => {
      random: () => number;
      handleMessage: (message: unknown) => void;
      process: (inputs: unknown[], outputs: Float32Array[][]) => boolean;
    }) | null = null;
    class FakeAudioWorkletProcessor {
      port = { onmessage: null as null | ((event: { data: unknown }) => void), postMessage: () => undefined };
    }
    const context = createContext({
      AudioWorkletProcessor: FakeAudioWorkletProcessor,
      registerProcessor: (_name: string, ctor: typeof Processor) => {
        Processor = ctor;
      },
      sampleRate: 48_000,
      Math,
      Number,
    });
    runInContext(source, context);
    expect(Processor).not.toBeNull();
    const seeded = () => {
      let seed = 1234;
      return () => {
        seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
        return seed / 4_294_967_296;
      };
    };
    for (const engine of [v8, ev, findEngine("rotativo_turbo")]) {
      const processor = new Processor!();
      processor.random = seeded();
      processor.handleMessage({ type: "engine", engine });
      processor.handleMessage({ type: "drive", rpm: engine.idle + (engine.redline - engine.idle) * 0.5, throttle: 0.7 });
      processor.handleMessage({ type: "running", value: true });
      const workletOut = new Float32Array(1024);
      processor.process([], [[workletOut]]);
      const synth = new EngineSynth(engine, seeded());
      synth.setDrive(engine.idle + (engine.redline - engine.idle) * 0.5, 0.7);
      const synthOut = new Float32Array(1024);
      synth.render(synthOut, 48_000);
      for (let i = 0; i < 1024; i += 1) {
        expect(Math.abs((workletOut[i] ?? 0) - (synthOut[i] ?? 0))).toBeLessThan(1e-6);
      }
    }
  });
});

describe("TECLA Drive GPS helpers", () => {
  it("rates accuracy, wraps heading deltas and holds speed when the signal drops", () => {
    expect(qualityFromAccuracy(8)).toBe("good");
    expect(qualityFromAccuracy(30)).toBe("fair");
    expect(qualityFromAccuracy(90)).toBe("poor");
    expect(qualityFromAccuracy(null)).toBeNull();
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(10, 350)).toBe(-20);
    expect(holdSpeedWhenStale(80, GPS_HOLD_SECONDS)).toBe(80);
    expect(holdSpeedWhenStale(80, GPS_HOLD_SECONDS + 4)).toBeCloseTo(40, 5);
    expect(holdSpeedWhenStale(80, 60)).toBe(0);
  });

  it("converts device speed from m/s to km/h and caps it", () => {
    const fix = {
      latitude: 9.3047,
      longitude: -75.3978,
      timestamp: 1_000,
      accuracy: 8,
      speed: 10,
      heading: null,
      altitude: null,
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
      heading: null,
      altitude: null,
    };
    const second = { ...first, latitude: 9.3048, timestamp: 2_000 };
    const speed = estimateSpeedKmh(first, second);
    expect(speed).not.toBeNull();
    expect(speed).toBeGreaterThan(30);
    expect(speed).toBeLessThan(130);
  });
});
