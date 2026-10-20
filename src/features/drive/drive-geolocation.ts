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
}

export interface DriveGeoState {
  status: DriveGeoStatus;
  speedKmh: number;
  accuracyM: number | null;
  error: string | null;
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
  };
}

function geoErrorMessage(code: number): string {
  if (code === 1) return "El GPS está bloqueado. Permite la ubicación o usa el modo Demo.";
  if (code === 2) return "No pudimos obtener tu ubicación. Prueba al aire libre o usa Demo.";
  return "La señal GPS tardó demasiado. Puedes reintentar o usar Demo.";
}

export function useDriveGeolocation(onFailure?: (message: string) => void) {
  const failureRef = React.useRef(onFailure);
  const [state, setState] = React.useState<DriveGeoState>({
    status: "idle",
    speedKmh: 0,
    accuracyM: null,
    error: null,
  });
  const watchRef = React.useRef<number | null>(null);
  const lastFixRef = React.useRef<DriveFix | null>(null);
  const smoothedRef = React.useRef(0);

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
    watchRef.current = null;
    lastFixRef.current = null;
    smoothedRef.current = 0;
    setState({ status: "idle", speedKmh: 0, accuracyM: null, error: null });
  }, []);

  const start = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = "Este navegador no ofrece GPS. Puedes usar el modo Demo.";
      setState({ status: "unavailable", speedKmh: 0, accuracyM: null, error: message });
      failureRef.current?.(message);
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = "El GPS requiere HTTPS. Corrige el certificado o usa el modo Demo.";
      setState({ status: "unavailable", speedKmh: 0, accuracyM: null, error: message });
      failureRef.current?.(message);
      return;
    }
    if (watchRef.current !== null) return;

    setState((previous) => ({
      ...previous,
      status: "requesting",
      speedKmh: 0,
      accuracyM: null,
      error: null,
    }));

    try {
      watchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const fix = toFix(position);
          const previous = lastFixRef.current;
          const raw = estimateSpeedKmh(previous, fix);
          lastFixRef.current = fix;

          if (raw !== null) {
            const smoothed =
              smoothedRef.current > 0 ? smoothedRef.current * 0.55 + raw * 0.45 : raw;
            smoothedRef.current = smoothed;
            const speedKmh = Math.min(MAX_SPEED, Math.max(0, smoothed));
            setState({
              status: "active",
              speedKmh,
              accuracyM: fix.accuracy,
              error: null,
            });
          } else {
            setState({
              status: "active",
              speedKmh: 0,
              accuracyM: fix.accuracy,
              error: null,
            });
          }
        },
        (error) => {
          watchRef.current = null;
          lastFixRef.current = null;
          smoothedRef.current = 0;
          const message = geoErrorMessage(error.code);
          setState({
            status: error.code === 1 ? "denied" : error.code === 2 ? "unavailable" : "error",
            speedKmh: 0,
            accuracyM: null,
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
      setState({ status: "error", speedKmh: 0, accuracyM: null, error: message });
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
