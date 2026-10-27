"use client";

import * as React from "react";
import type { DriveGeoState } from "./drive-geolocation";
import { useDriveStore } from "@/stores/drive";
import {
  createLaunch,
  createTrip,
  launchStep,
  updateTrip,
  type LaunchState,
  type TripStats,
} from "./telemetry";

/**
 * Acumula la telemetría del viaje con cada fix del GPS y lleva el
 * cronómetro 0–100. Se reinicia al apagar el GPS o al tocar «Reiniciar».
 * Nada sale del navegador: ni posiciones ni tiempos.
 */
export function useDriveTelemetry(geo: Pick<DriveGeoState, "status" | "speedKmh" | "lastFix">, active: boolean) {
  const [trip, setTrip] = React.useState<TripStats>(createTrip);
  const [launch, setLaunch] = React.useState<LaunchState>(createLaunch);
  const bestLaunchMs = useDriveStore((state) => state.bestLaunchMs);
  const setBestLaunch = useDriveStore((state) => state.setBestLaunch);
  const lastTickRef = React.useRef<number>(0);
  const lastFixRef = React.useRef<number>(0);

  // Viaje: un paso por fix nuevo.
  React.useEffect(() => {
    if (!active || geo.status !== "active" || !geo.lastFix) return;
    if (geo.lastFix.timestamp === lastFixRef.current) return;
    lastFixRef.current = geo.lastFix.timestamp;
    const fix = geo.lastFix;
    setTrip((previous) => updateTrip(previous, fix, geo.speedKmh));
  }, [active, geo.status, geo.lastFix, geo.speedKmh]);

  // Cronómetro: muestrea cada 100 ms la velocidad suavizada.
  React.useEffect(() => {
    if (!active || geo.status !== "active") return;
    lastTickRef.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTickRef.current) / 1_000;
      lastTickRef.current = now;
      setLaunch((previous) => {
        const next = launchStep(previous, geo.speedKmh, now, dt);
        if (next.phase === "done" && previous.phase !== "done" && next.resultMs !== null) {
          const best = useDriveStore.getState().bestLaunchMs;
          if (best === null || next.resultMs < best) setBestLaunch(next.resultMs);
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [active, geo.status, geo.speedKmh, setBestLaunch]);

  const reset = React.useCallback(() => {
    setTrip(createTrip());
    setLaunch(createLaunch());
    lastFixRef.current = 0;
  }, []);

  React.useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  return { trip, launch, bestLaunchMs, reset, resetBest: () => setBestLaunch(null) };
}
