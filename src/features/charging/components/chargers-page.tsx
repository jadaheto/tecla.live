"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ChargersExplorer } from "@/components/charging/chargers-explorer";
import type { GeoPoint } from "@/features/charging/hooks";
import { useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import { usePreferences } from "@/stores/preferences";

/**
 * Pestaña «Cargadores»: estaciones de carga cercanas en el mapa de TECLA con
 * la ruta a la estación elegida. Origen por prioridad: posición real del
 * Tesla (vinculado y despierto) → ubicación del navegador (a petición) →
 * ciudad del clima.
 */
export function ChargersPage() {
  const status = useTeslaStatus();
  const vehicle = useTeslaVehicle(status.data?.connected ?? false);
  const weatherLat = usePreferences((state) => state.weatherLat);
  const weatherLon = usePreferences((state) => state.weatherLon);
  const weatherLocation = usePreferences((state) => state.weatherLocation);
  const [browser, setBrowser] = React.useState<GeoPoint | null>(null);
  const [browserError, setBrowserError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  const carLocation = vehicle.data && !vehicle.data.asleep ? vehicle.data.location : null;
  const origin: GeoPoint = carLocation ?? browser ?? { latitude: weatherLat, longitude: weatherLon };
  const originKind: "car" | "device" = carLocation ? "car" : "device";
  const originLabel = carLocation ? `tu Tesla (${vehicle.data?.name ?? "auto"})` : browser ? "este dispositivo" : (weatherLocation.split(",")[0]?.trim() ?? "tu ciudad");

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setBrowserError("Este navegador no ofrece ubicación.");
      return;
    }
    setLocating(true);
    setBrowserError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowser({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setBrowserError("No pudimos leer la ubicación del navegador.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Estaciones de carga"
        title="Cargadores"
        description="Estaciones cercanas en el mapa de TECLA. Toca una y verás la ruta desde tu Tesla; luego ábrela en Waze o Google Maps para navegar."
      />
      {!carLocation && status.data?.configured && !status.data.connected ? (
        <p className="mb-3 text-[12px] text-muted">
          <Link href="/settings#mi-tesla" className="text-accent hover:underline">Vincula tu Tesla</Link> para que el origen sea la posición real del auto.
        </p>
      ) : null}
      {browserError ? <p className="mb-3 text-[12px] text-amber-300/90">{browserError}</p> : null}
      <ChargersExplorer origin={origin} originKind={originKind} originLabel={originLabel} onLocate={carLocation ? undefined : locate} locating={locating} />
    </div>
  );
}
