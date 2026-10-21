"use client";

import * as React from "react";
import { MAX_SPEED } from "./drive-config";

export type DriveGeoStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

export interface DriveFix {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export type DriveGeoQuality = "good" | "fair" | "poor";

export interface DriveGeoState {
  status: DriveGeoStatus;
  speedKmh: number;
  accuracyM: number | null;
  error: string | null;
  /** Calidad de la señal según la precisión reportada. */
  quality: DriveGeoQuality | null;
  /** Giro en grados por segundo (positivo a la derecha), suavizado. */
  turnRateDegPerSec: number;
  /** Segundos desde el último fix válido. */
  staleSeconds: number;
}

/** Tras este tiempo sin fix se conserva la velocidad; después decae. */
export const GPS_HOLD_SECONDS = 4;
export const GPS_DECAY_SECONDS = 8;

export function qualityFromAccuracy(accuracy: number | null): DriveGeoQuality | null {
  if (accuracy === null || !Number.isFinite(accuracy)) return null;
  if (accuracy <= 15) return "good";
  if (accuracy <= 40) return "fair";
  return "poor";
}

/** Diferencia angular mínima entre dos rumbos (−180…180). */
export function headingDelta(previous: number, current: number): number {
  let delta = current - previous;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/**
 * Velocidad a aplicar cuando el GPS deja de reportar: se mantiene durante
 * GPS_HOLD_SECONDS y luego baja linealmente a cero en GPS_DECAY_SECONDS.
 */
export function holdSpeedWhenStale(lastSpeedKmh: number, staleSeconds: number): number {
  if (staleSeconds <= GPS_HOLD_SECONDS) return lastSpeedKmh;
  const decay = Math.min(1, (staleSeconds - GPS_HOLD_SECONDS) / GPS_DECAY_SECONDS);
  return Math.max(0, lastSpeedKmh * (1 - decay));
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: DriveFix, b: DriveFix): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Prioriza la velocidad que reporta el dispositivo (m/s) y, si no existe,
 * la calcula con la distancia Haversine entre dos fixes. Devuelve km/h.
 */
export function estimateSpeedKmh(previous: DriveFix | null, current: DriveFix): number | null {
  if (typeof current.speed === "number" && Number.isFinite(current.speed) && current.speed >= 0) {
    return Math.min(MAX_SPEED, current.speed * 3.6);
  }
  if (!previous) return null;
  const seconds = (current.timestamp - previous.timestamp) / 1_000;
  if (!Number.isFinite(seconds) || seconds < 0.4 || seconds > 15) return null;
  return Math.min(MAX_SPEED, (distanceMeters(previous, current) / seconds) * 3.6);
}

function toFix(position: GeolocationPosition): DriveFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timestamp: position.timestamp || Date.now(),
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 0,
    speed:
      typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed)
        ? position.coords.speed
        : null,
    heading:
      typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
        ? position.coords.heading
        : null,
  };
}

const IDLE_STATE: DriveGeoState = {
  status: "idle",
  speedKmh: 0,
  accuracyM: null,
  error: null,
  quality: null,
  turnRateDegPerSec: 0,
  staleSeconds: 0,
};

function geoErrorMessage(code: number): string {
  if (code === 1) return "El GPS está bloqueado. Permite la ubicación o usa el modo Demo.";
  if (code === 2) return "No pudimos obtener tu ubicación. Prueba al aire libre o usa Demo.";
  return "La señal GPS tardó demasiado. Puedes reintentar o usar Demo.";
}

export function useDriveGeolocation(onFailure?: (message: string) => void) {
  const failureRef = React.useRef(onFailure);
  const [state, setState] = React.useState<DriveGeoState>(IDLE_STATE);
  const watchRef = React.useRef<number | null>(null);
  const lastFixRef = React.useRef<DriveFix | null>(null);
  const smoothedRef = React.useRef(0);
  const turnRef = React.useRef(0);
  const lastFixAtRef = React.useRef(0);
  const staleTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    failureRef.current = onFailure;
  }, [onFailure]);

  const stop = React.useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined") {
      try {
        navigator.geolocation.clearWatch(watchRef.current);
      } catch {
        // El navegador pudo invalidar el watch al salir de contexto seguro.
      }
    }
    if (staleTimerRef.current !== null) {
      window.clearInterval(staleTimerRef.current);
      staleTimerRef.current = null;
    }
    watchRef.current = null;
    lastFixRef.current = null;
    smoothedRef.current = 0;
    turnRef.current = 0;
    lastFixAtRef.current = 0;
    setState(IDLE_STATE);
  }, []);

  const start = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = "Este navegador no ofrece GPS. Puedes usar el modo Demo.";
      setState({ ...IDLE_STATE, status: "unavailable", error: message });
      failureRef.current?.(message);
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = "El GPS requiere HTTPS. Corrige el certificado o usa el modo Demo.";
      setState({ ...IDLE_STATE, status: "unavailable", error: message });
      failureRef.current?.(message);
      return;
    }
    if (watchRef.current !== null) return;

    setState({ ...IDLE_STATE, status: "requesting" });

    staleTimerRef.current = window.setInterval(() => {
      if (!lastFixAtRef.current) return;
      const staleSeconds = (Date.now() - lastFixAtRef.current) / 1_000;
      if (staleSeconds < 1.5) return;
      const held = holdSpeedWhenStale(smoothedRef.current, staleSeconds);
      turnRef.current *= 0.8;
      setState((previous) =>
        previous.status === "active"
          ? { ...previous, speedKmh: held, staleSeconds, turnRateDegPerSec: turnRef.current }
          : previous,
      );
    }, 1_000);

    try {
      watchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const fix = toFix(position);
          const previous = lastFixRef.current;
          const raw = estimateSpeedKmh(previous, fix);
          lastFixRef.current = fix;
          lastFixAtRef.current = Date.now();

          if (
            previous &&
            previous.heading !== null &&
            fix.heading !== null &&
            raw !== null &&
            raw > 4
          ) {
            const seconds = (fix.timestamp - previous.timestamp) / 1_000;
            if (seconds > 0.3 && seconds < 10) {
              const rate = headingDelta(previous.heading, fix.heading) / seconds;
              turnRef.current = turnRef.current * 0.5 + Math.max(-45, Math.min(45, rate)) * 0.5;
            }
          } else {
            turnRef.current *= 0.6;
          }

          if (raw !== null) {
            const smoothed =
              smoothedRef.current > 0 ? smoothedRef.current * 0.55 + raw * 0.45 : raw;
            smoothedRef.current = smoothed;
          }
          setState({
            status: "active",
            speedKmh: raw !== null ? Math.min(MAX_SPEED, Math.max(0, smoothedRef.current)) : 0,
            accuracyM: fix.accuracy,
            error: null,
            quality: qualityFromAccuracy(fix.accuracy),
            turnRateDegPerSec: turnRef.current,
            staleSeconds: 0,
          });
        },
        (error) => {
          // Un timeout con fixes previos no es fatal: la retención de velocidad sigue activa.
          if (error.code === 3 && lastFixAtRef.current) return;
          if (staleTimerRef.current !== null) {
            window.clearInterval(staleTimerRef.current);
            staleTimerRef.current = null;
          }
          watchRef.current = null;
          lastFixRef.current = null;
          smoothedRef.current = 0;
          const message = geoErrorMessage(error.code);
          setState({
            ...IDLE_STATE,
            status: error.code === 1 ? "denied" : error.code === 2 ? "unavailable" : "error",
            error: message,
          });
          failureRef.current?.(message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1_000,
          timeout: 15_000,
        },
      );
    } catch {
      watchRef.current = null;
      const message = "No pudimos activar el GPS. Revisa el permiso o usa el modo Demo.";
      setState({ ...IDLE_STATE, status: "error", error: message });
      failureRef.current?.(message);
    }
  }, []);

  React.useEffect(() => stop, [stop]);

  return {
    ...state,
    start,
    stop,
  };
}
