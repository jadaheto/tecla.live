"use client";

import { Compass, Mountain, Route, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSpeed } from "./drive-config";
import type { DriveGeoState } from "./drive-geolocation";
import {
  LAUNCH_TARGET_KMH,
  averageKmh,
  compassLabel,
  formatDistance,
  formatElapsed,
  formatLaunch,
  type LaunchState,
  type TripStats,
} from "./telemetry";

function Reading({ icon: Icon, label, value, sub, accent, className }: { icon: typeof Compass; label: string; value: string; sub?: string; accent?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-[104px] flex-1 flex-col items-center rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-center backdrop-blur-md", className)}>
      <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
        <Icon className="size-3" aria-hidden />
        {label}
      </span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums leading-none" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub ? <span className="mt-1 text-[9px] text-white/45">{sub}</span> : null}
    </div>
  );
}

/** Rosa de los vientos que gira con el rumbo real. */
function CompassRose({ heading, accent }: { heading: number | null; accent: string }) {
  const rotation = heading === null ? 0 : -heading;
  return (
    <svg viewBox="0 0 48 48" className="size-11" aria-hidden>
      <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "24px 24px", transition: "transform 0.6s ease" }}>
        <polygon points="24,5 28,24 24,21 20,24" fill={accent} />
        <polygon points="24,43 28,24 24,27 20,24" fill="rgba(255,255,255,0.35)" />
        <text x="24" y="3.5" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.7)">N</text>
      </g>
      <circle cx="24" cy="24" r="2" fill="#fff" />
    </svg>
  );
}

/**
 * Franja de telemetría de TECLA Drive (solo con GPS real): rumbo, altitud,
 * distancia del viaje, velocidad máxima y promedio, y cronómetro 0–100 con
 * la mejor marca guardada en este dispositivo.
 */
export function DriveTelemetry({
  geo,
  trip,
  launch,
  bestLaunchMs,
  useKmh,
  accent,
  onReset,
  className,
}: {
  geo: Pick<DriveGeoState, "heading" | "altitudeM" | "speedKmh">;
  trip: TripStats;
  launch: LaunchState;
  bestLaunchMs: number | null;
  useKmh: boolean;
  accent: string;
  onReset: () => void;
  className?: string;
}) {
  const unit = useKmh ? "km/h" : "mph";
  const launchValue =
    launch.phase === "running"
      ? `${(launch.elapsedMs / 1_000).toFixed(1)} s`
      : launch.phase === "done"
        ? formatLaunch(launch.resultMs)
        : launch.phase === "armed"
          ? "LISTO"
          : "—";
  const launchSub =
    launch.phase === "armed"
      ? `Acelera: mide 0–${LAUNCH_TARGET_KMH}`
      : launch.phase === "running"
        ? "Midiendo…"
        : bestLaunchMs !== null
          ? `Mejor: ${formatLaunch(bestLaunchMs)}`
          : "Detente 1 s para armar";

  return (
    <div className={cn("flex w-full flex-wrap items-stretch justify-center gap-2", className)} aria-label="Telemetría GPS">
      <div className="flex min-w-[104px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
        <CompassRose heading={geo.heading} accent={accent} />
        <div className="text-center">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">Rumbo</span>
          <span className="block text-lg font-semibold tabular-nums leading-none">{compassLabel(geo.heading)}</span>
          <span className="block text-[9px] text-white/45">{geo.heading === null ? "sin rumbo" : `${Math.round(geo.heading)}°`}</span>
        </div>
      </div>
      <Reading icon={Mountain} label="Altitud" value={geo.altitudeM === null ? "—" : `${Math.round(geo.altitudeM)} m`} sub="sobre el mar" />
      <Reading icon={Route} label="Viaje" value={formatDistance(trip.distanceM, useKmh)} sub={trip.movingSeconds > 0 ? `${formatElapsed(trip.movingSeconds)} en marcha` : "en marcha 0:00"} />
      <Reading icon={Compass} label="Máx · Prom" value={`${formatSpeed(trip.maxKmh, useKmh)} · ${formatSpeed(averageKmh(trip), useKmh)}`} sub={unit} />
      <Reading
        icon={Timer}
        label={`0–${LAUNCH_TARGET_KMH}`}
        value={launchValue}
        sub={launchSub}
        accent={launch.phase === "done" ? accent : undefined}
        className={cn(launch.phase === "running" && "border-amber-300/50", launch.phase === "armed" && "border-[#34d399]/50")}
      />
      <button
        type="button"
        onClick={onReset}
        aria-label="Reiniciar telemetría del viaje"
        className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-white/10 bg-black/35 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 backdrop-blur-md"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reiniciar
      </button>
    </div>
  );
}
