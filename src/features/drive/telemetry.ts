import type { DriveFix } from "./drive-geolocation";
import { bearingDegrees, distanceMeters } from "./drive-geolocation";

export { bearingDegrees };

/**
 * Telemetría de TECLA Drive a partir del GPS real: rumbo, altitud, viaje
 * (distancia, máxima, promedio, tiempo en marcha) y cronómetro 0–100.
 * Todo es lógica pura y probada; el HUD solo la dibuja.
 */
export const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;

export function compassLabel(heading: number | null): string {
  if (heading === null || !Number.isFinite(heading)) return "—";
  const normalized = ((heading % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? "N";
}

export interface TripStats {
  startedAt: number | null;
  distanceM: number;
  maxKmh: number;
  movingSeconds: number;
  /** Suma de velocidades (km/h) por segundo en marcha, para el promedio. */
  speedIntegral: number;
  lastFix: DriveFix | null;
}

export function createTrip(): TripStats {
  return { startedAt: null, distanceM: 0, maxKmh: 0, movingSeconds: 0, speedIntegral: 0, lastFix: null };
}

/** Velocidad mínima (km/h) para contar distancia y tiempo en marcha. */
const MOVING_KMH = 3;
/** Un salto de más de este tamaño entre fixes se considera ruido de GPS. */
const MAX_JUMP_M = 400;
/** Precisión peor que esta (m) no suma distancia. */
const MAX_ACCURACY_M = 60;

export function updateTrip(trip: TripStats, fix: DriveFix, speedKmh: number): TripStats {
  const next: TripStats = { ...trip, lastFix: fix };
  if (next.startedAt === null) next.startedAt = fix.timestamp;
  if (speedKmh > next.maxKmh) next.maxKmh = speedKmh;
  const previous = trip.lastFix;
  if (!previous) return next;
  const seconds = (fix.timestamp - previous.timestamp) / 1_000;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) return next;
  if (speedKmh >= MOVING_KMH) {
    next.movingSeconds += seconds;
    next.speedIntegral += speedKmh * seconds;
    if (fix.accuracy <= MAX_ACCURACY_M) {
      const step = distanceMeters(previous, fix);
      if (step < MAX_JUMP_M) next.distanceM += step;
    }
  }
  return next;
}

export function averageKmh(trip: TripStats): number {
  if (trip.movingSeconds <= 0) return 0;
  return trip.speedIntegral / trip.movingSeconds;
}

export function formatDistance(meters: number, useKm = true): string {
  if (!useKm) {
    const miles = meters / 1_609.344;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  if (meters < 1_000) return `${Math.round(meters)} m`;
  const km = meters / 1_000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- Cronómetro 0–100 ---------- */
export type LaunchPhase = "waiting" | "armed" | "running" | "done" | "aborted";

export interface LaunchState {
  phase: LaunchPhase;
  /** Instante (ms) en que el auto empezó a moverse. */
  startedAt: number | null;
  /** Tiempo final (ms) al alcanzar la meta. */
  resultMs: number | null;
  /** Segundos detenido acumulados para armar el cronómetro. */
  stillSeconds: number;
  /** Tiempo transcurrido (ms) mientras corre, para mostrarlo en vivo. */
  elapsedMs: number;
}

export const LAUNCH_TARGET_KMH = 100;
const LAUNCH_START_KMH = 1.5;
const LAUNCH_ARM_SECONDS = 1;
const LAUNCH_MAX_SECONDS = 40;

export function createLaunch(): LaunchState {
  return { phase: "waiting", startedAt: null, resultMs: null, stillSeconds: 0, elapsedMs: 0 };
}

/**
 * Avanza el cronómetro con cada muestra. Se arma tras un segundo detenido,
 * arranca al superar 1,5 km/h y termina al llegar a 100 km/h; si el auto se
 * detiene antes, o pasan 40 s, se aborta y vuelve a esperar.
 */
export function launchStep(state: LaunchState, speedKmh: number, now: number, dtSeconds: number): LaunchState {
  switch (state.phase) {
    case "waiting":
    case "aborted":
    case "done": {
      if (speedKmh < LAUNCH_START_KMH) {
        const stillSeconds = state.stillSeconds + dtSeconds;
        return stillSeconds >= LAUNCH_ARM_SECONDS
          ? { phase: "armed", startedAt: null, resultMs: state.phase === "done" ? state.resultMs : null, stillSeconds, elapsedMs: 0 }
          : { ...state, stillSeconds };
      }
      return { ...state, stillSeconds: 0 };
    }
    case "armed": {
      if (speedKmh >= LAUNCH_START_KMH) return { phase: "running", startedAt: now, resultMs: null, stillSeconds: 0, elapsedMs: 0 };
      return state;
    }
    case "running": {
      const startedAt = state.startedAt ?? now;
      const elapsed = now - startedAt;
      if (speedKmh >= LAUNCH_TARGET_KMH) return { phase: "done", startedAt, resultMs: elapsed, stillSeconds: 0, elapsedMs: elapsed };
      if (speedKmh < LAUNCH_START_KMH && elapsed > 1_500) return { phase: "aborted", startedAt: null, resultMs: null, stillSeconds: 0, elapsedMs: 0 };
      if (elapsed > LAUNCH_MAX_SECONDS * 1_000) return { phase: "aborted", startedAt: null, resultMs: null, stillSeconds: 0, elapsedMs: 0 };
      // Objeto nuevo en cada muestra para que el HUD refresque el tiempo en vivo.
      return { ...state, elapsedMs: elapsed };
    }
    default:
      return state;
  }
}

export function formatLaunch(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1_000).toFixed(2)} s`;
}
