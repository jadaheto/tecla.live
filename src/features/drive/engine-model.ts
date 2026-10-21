/**
 * Modelo puro de transmisión y modos de conducción de TECLA DRIVE.
 * No toca el DOM ni Web Audio: recibe un estado, entradas y dt, y devuelve
 * el siguiente estado junto con los eventos sonoros que deben dispararse.
 * Todas las velocidades están en km/h.
 */
import {
  LAUNCH_TARGET_SPEED,
  MAX_SPEED,
  clampSpeed,
  rpmNorm,
  type DriveEngine,
} from "./drive-config";

/** Velocidad (km/h) a la que cada marcha toca el corte. */
export const GEAR_TOP_KMH: readonly number[] = [42, 74, 113, 153, 196, 241, 290];
export const MAX_GEAR = GEAR_TOP_KMH.length;

export type DriveMode = "idle" | "rev" | "launch" | "cruise" | "gps";

export interface DriveSimState {
  mode: DriveMode;
  speedKmh: number;
  rpm: number;
  gear: number;
  throttle: number;
  manualGear: boolean;
  launchTicks: number;
  cruiseTarget: number;
  cruiseTimer: number;
}

export interface DriveSimInputs {
  /** Velocidad real del GPS (km/h); solo se usa en modo `gps`. */
  gpsSpeedKmh: number;
  /** Pedal táctil de acelerar (solo modo `idle`). */
  accelerating: boolean;
  /** Pedal táctil de frenar (solo modo `idle`). */
  braking: boolean;
  /** Curvatura de la carretera unos metros adelante (−1…1). */
  curvatureAhead: number;
}

export interface DriveSimEvents {
  /** Petardeos / válvula de descarga: cambio de marcha o fin de arrancada. */
  liftOff: boolean;
  /** Subió de marcha (automático o manual). */
  shifted: boolean;
}

export const DEFAULT_INPUTS: DriveSimInputs = {
  gpsSpeedKmh: 0,
  accelerating: false,
  braking: false,
  curvatureAhead: 0,
};

export function createDriveState(engine: DriveEngine): DriveSimState {
  return {
    mode: "idle",
    speedKmh: 0,
    rpm: engine.idle,
    gear: 1,
    throttle: 0,
    manualGear: false,
    launchTicks: 0,
    cruiseTarget: 0,
    cruiseTimer: 0,
  };
}

export function rpmFromSpeed(engine: DriveEngine, speedKmh: number, gear: number): number {
  if (engine.cylinders === 0) {
    return engine.idle + Math.min(1, speedKmh / 250) * (engine.redline - engine.idle);
  }
  const top = GEAR_TOP_KMH[Math.min(MAX_GEAR, Math.max(1, gear)) - 1] ?? 42;
  return Math.max(engine.idle, engine.idle + (speedKmh / top) * (engine.redline * 0.96 - engine.idle));
}

/** Devuelve la marcha automática adecuada y si hubo subida (para petardeos). */
export function autoShift(
  engine: DriveEngine,
  speedKmh: number,
  gear: number,
  throttle: number,
): { gear: number; shiftedUp: boolean } {
  if (engine.cylinders === 0) return { gear, shiftedUp: false };
  const rpm = rpmFromSpeed(engine, speedKmh, gear);
  const upAt = engine.redline * (0.55 + throttle * 0.37);
  const downAt = engine.idle + (engine.redline - engine.idle) * 0.14;
  if (gear < MAX_GEAR && rpm > upAt) return { gear: gear + 1, shiftedUp: true };
  if (gear > 1 && rpm < downAt) return { gear: gear - 1, shiftedUp: false };
  return { gear, shiftedUp: false };
}

function throttleFromAccel(throttle: number, speedKmh: number, accelKmhPerSec: number): number {
  const target =
    accelKmhPerSec > 0.48
      ? Math.min(1, 0.35 + accelKmhPerSec * 0.112)
      : speedKmh > 5
        ? 0.18
        : 0.05;
  return throttle + (target - throttle) * 0.08;
}

/**
 * Avanza la simulación un cuadro. `dtSeconds` se limita a 50 ms para que
 * una pestaña en segundo plano no provoque saltos.
 */
export function stepDrive(
  engine: DriveEngine,
  previous: DriveSimState,
  inputs: DriveSimInputs,
  dtSeconds: number,
  random: () => number = Math.random,
): { state: DriveSimState; events: DriveSimEvents } {
  const dt = Math.min(0.05, Math.max(0.001, Number.isFinite(dtSeconds) ? dtSeconds : 0.016));
  const k = dt * 60;
  const state: DriveSimState = { ...previous };
  const events: DriveSimEvents = { liftOff: false, shifted: false };
  const limiter = engine.redline - 40;

  const applyAutoShift = () => {
    if (state.manualGear) return;
    const shift = autoShift(engine, state.speedKmh, state.gear, state.throttle);
    if (shift.gear !== state.gear) {
      state.gear = shift.gear;
      if (shift.shiftedUp) {
        events.shifted = true;
        events.liftOff = true;
      }
    }
  };

  if (state.mode === "rev") {
    state.throttle += (1 - state.throttle) * 0.2;
    state.rpm = Math.min(engine.redline, state.rpm + (engine.redline - engine.idle) * 0.028 * k);
    if (state.rpm >= limiter) state.rpm -= 320;
    state.speedKmh = Math.max(0, state.speedKmh - 0.64 * k);
  } else if (state.mode === "launch") {
    state.launchTicks += k;
    state.throttle += (1 - state.throttle) * 0.15;
    state.speedKmh = Math.min(
      LAUNCH_TARGET_SPEED,
      state.speedKmh + (0.885 - state.speedKmh * 0.005) * k,
    );
    applyAutoShift();
    state.rpm += (rpmFromSpeed(engine, state.speedKmh, state.gear) - state.rpm) * 0.25;
    if (state.speedKmh >= LAUNCH_TARGET_SPEED || state.launchTicks > 400) {
      events.liftOff = true;
      state.mode = "cruise";
      state.cruiseTarget = 96;
      state.cruiseTimer = 0;
    }
  } else if (state.mode === "gps") {
    const before = state.speedKmh;
    state.speedKmh += (clampSpeed(inputs.gpsSpeedKmh) - state.speedKmh) * 0.1 * k;
    state.throttle = throttleFromAccel(state.throttle, state.speedKmh, (state.speedKmh - before) / dt);
    applyAutoShift();
    state.rpm += (rpmFromSpeed(engine, state.speedKmh, state.gear) - state.rpm) * 0.2;
  } else if (state.mode === "cruise") {
    state.cruiseTimer += dt;
    const curve = Math.abs(inputs.curvatureAhead);
    const wanted = Math.max(
      45,
      Math.min(153, 120 + Math.sin(state.cruiseTimer * 0.15) * 32 - curve * 56),
    );
    state.cruiseTarget += (wanted - state.cruiseTarget) * 0.02;
    const before = state.speedKmh;
    const accel = state.cruiseTarget > state.speedKmh ? 0.354 : -0.483;
    state.speedKmh = Math.max(0, state.speedKmh + accel * k);
    state.throttle = throttleFromAccel(state.throttle, state.speedKmh, (state.speedKmh - before) / dt);
    if (before > state.speedKmh + 0.001 && state.throttle > 0.3 && random() < 0.02) {
      events.liftOff = true;
    }
    applyAutoShift();
    state.rpm += (rpmFromSpeed(engine, state.speedKmh, state.gear) - state.rpm) * 0.2;
  } else {
    // idle: pedales táctiles o desaceleración libre
    if (inputs.accelerating) {
      state.throttle += (0.95 - state.throttle) * 0.15;
      state.speedKmh += (34 - state.speedKmh * 0.09) * dt;
    } else if (inputs.braking) {
      state.throttle += (0.05 - state.throttle) * 0.2;
      state.speedKmh -= 56 * dt;
    } else {
      state.throttle += (0.05 - state.throttle) * 0.1;
      state.speedKmh -= 0.8 * k;
    }
    state.speedKmh = Math.max(0, state.speedKmh);
    applyAutoShift();
    state.rpm += (rpmFromSpeed(engine, state.speedKmh, state.gear) - state.rpm) * 0.12;
    if (state.speedKmh < 1 && !state.manualGear) state.gear = 1;
  }

  if (state.manualGear && engine.cylinders > 0 && state.mode !== "rev") {
    state.rpm = Math.min(engine.redline, rpmFromSpeed(engine, state.speedKmh, state.gear));
    if (state.rpm >= limiter) state.rpm -= 300;
  }

  state.speedKmh = clampSpeed(state.speedKmh);
  state.rpm = Math.max(engine.idle, Math.min(engine.redline, state.rpm));
  state.throttle = Math.max(0, Math.min(1, state.throttle));
  return { state, events };
}

/** Cambio manual de marcha; devuelve si hubo cambio (para petardeos). */
export function shiftGear(state: DriveSimState, direction: 1 | -1): DriveSimState {
  const gear = Math.min(MAX_GEAR, Math.max(1, state.gear + direction));
  if (gear === state.gear) return state;
  return { ...state, gear };
}

/** Factor de avance visual de la carretera a partir de la velocidad. */
export function sceneSpeedFactor(engine: DriveEngine, state: DriveSimState): number {
  const revBoost = state.mode === "rev" ? rpmNorm(engine, state.rpm) * 0.6 : 0;
  return (clampSpeed(state.speedKmh) / 96.6) * 6.5 + revBoost;
}

export function describeDriveState(state: Pick<DriveSimState, "mode" | "speedKmh">): string {
  if (state.mode === "gps") return state.speedKmh > 2 ? "CONDUCIENDO" : "DETENIDO";
  if (state.mode === "cruise") return "PASEO AUTOMÁTICO";
  if (state.mode === "launch") return "ARRANCADA";
  if (state.mode === "rev" || state.speedKmh > 2) return "ACELERANDO";
  return "EN REPOSO";
}

export { MAX_SPEED };
