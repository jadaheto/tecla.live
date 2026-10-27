"use client";

import * as React from "react";
import Link from "next/link";
import { Car, LocateFixed, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlugShareMap } from "@/components/charging/plugshare-map";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/features/settings/components/settings-ui";
import { useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import type { PlugShareCenter } from "@/features/charging/plugshare";
import { usePreferences } from "@/stores/preferences";

type Radius = "10" | "25" | "50";

/**
 * Pantalla «Cargadores»: estaciones de carga cercanas con el mapa oficial de
 * PlugShare. Centro por prioridad: posición real del Tesla (si está vinculado
 * y despierto) → ubicación del navegador (a petición) → ciudad del clima.
 */
export function ChargersPage() {
  const status = useTeslaStatus();
  const vehicle = useTeslaVehicle(status.data?.connected ?? false);
  const weatherLat = usePreferences((state) => state.weatherLat);
  const weatherLon = usePreferences((state) => state.weatherLon);
  const weatherLocation = usePreferences((state) => state.weatherLocation);
  const [radius, setRadius] = React.useState<Radius>("25");
  const [browser, setBrowser] = React.useState<PlugShareCenter | null>(null);
  const [browserError, setBrowserError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  const carLocation = vehicle.data && !vehicle.data.asleep ? vehicle.data.location : null;
  const center: PlugShareCenter = carLocation ?? browser ?? { latitude: weatherLat, longitude: weatherLon };
  const sourceLabel = carLocation ? `tu Tesla (${vehicle.data?.name ?? "auto"})` : browser ? "este dispositivo" : weatherLocation.split(",")[0]?.trim() ?? "tu ciudad";

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
        setBrowserError("No pudimos leer la ubicación del navegador. Puedes mover el mapa a mano.");
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
        description="Estaciones de carga cercanas con el mapa de PlugShare: redes públicas, cargadores de destino y Supercargadores, con comentarios de otros conductores."
        actions={
          <>
            <Segmented<Radius>
              ariaLabel="Radio del mapa"
              value={radius}
              onChange={setRadius}
              options={[
                { value: "10", label: "10 km" },
                { value: "25", label: "25 km" },
                { value: "50", label: "50 km" },
              ]}
            />
            {!carLocation ? (
              <Button variant="glass" size="sm" onClick={locate} loading={locating}>
                <LocateFixed className="size-3.5" aria-hidden />
                Usar mi ubicación
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          {carLocation ? <Car className="size-3.5 text-accent" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
          Centro: {sourceLabel}
        </span>
        {!carLocation && status.data?.configured && !status.data.connected ? (
          <Link href="/settings#mi-tesla" className="text-accent hover:underline">
            Vincula tu Tesla para centrar el mapa en el auto
          </Link>
        ) : null}
        {browserError ? <span className="text-amber-300/90">{browserError}</span> : null}
      </div>

      <PlugShareMap center={center} radiusKm={Number(radius)} sourceLabel={sourceLabel} height={640} />

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        El mapa lo sirve PlugShare con su widget oficial para sitios web; las coordenadas del centro se envían a PlugShare para dibujarlo y el contenido es de PlugShare y sus usuarios. TECLA LIVE no guarda tu ubicación. Para navegar a una estación, tócala en el mapa y usa su enlace, o pídele la ruta a Waze desde Navegar.
      </p>
    </div>
  );
}
