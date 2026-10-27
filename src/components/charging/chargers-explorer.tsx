"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Car, Clock, ExternalLink, LocateFixed, MapPin, Navigation, Plug, Route, Zap } from "lucide-react";
import { PlugShareMap } from "@/components/charging/plugshare-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/features/settings/components/settings-ui";
import { useChargingStations, useDrivingRoute, type ChargingStation, type GeoPoint } from "@/features/charging/hooks";
import { useIntegrations } from "@/features/integrations/hooks";
import { buildGoogleMapsRouteUrl, buildWazeRouteUrl } from "@/lib/integrations/navigation";
import { powerTier } from "@/lib/integrations/open-charge-map";
import { errorMessage } from "@/lib/http";
import { cn } from "@/lib/utils";

const ChargersMap = dynamic(() => import("@/components/charging/chargers-map").then((module) => module.ChargersMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-[1.6rem]" />,
});

type Radius = "10" | "25" | "50";
type View = "tecla" | "plugshare";

const TIER_LABEL: Record<ReturnType<typeof powerTier>, string> = { fast: "Rápida", medium: "Media", slow: "Lenta", unknown: "Potencia s/d" };
const TIER_VARIANT: Record<ReturnType<typeof powerTier>, "warning" | "success" | "default" | "outline"> = { fast: "warning", medium: "success", slow: "default", unknown: "outline" };

/**
 * Explorador de estaciones de carga: lista de Open Charge Map + mapa propio
 * de TECLA con la ruta a la estación elegida (OSRM). PlugShare queda como
 * vista alternativa. `compact` lo reduce para la pantalla Mi Tesla.
 */
export function ChargersExplorer({
  origin,
  originKind,
  originLabel,
  onLocate,
  locating,
  compact = false,
}: {
  origin: GeoPoint;
  originKind: "car" | "device";
  originLabel: string;
  onLocate?: () => void;
  locating?: boolean;
  compact?: boolean;
}) {
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.chargers ?? true;
  const [radius, setRadius] = React.useState<Radius>(compact ? "25" : "25");
  const [view, setView] = React.useState<View>("tecla");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const stations = useChargingStations(origin, Number(radius), configured && view === "tecla");
  const list = React.useMemo(() => stations.data?.stations ?? [], [stations.data]);
  const selected = list.find((station) => station.id === selectedId) ?? null;
  const route = useDrivingRoute(selected ? origin : null, selected);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (!selectedId || !listRef.current) return;
    listRef.current.querySelector<HTMLElement>(`[data-station="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const mapHeight = compact ? 420 : 640;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            {originKind === "car" ? <Car className="size-3.5 text-accent" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
            Origen: {originLabel}
          </span>
          {onLocate ? (
            <Button variant="glass" size="sm" onClick={onLocate} loading={locating}>
              <LocateFixed className="size-3.5" aria-hidden />
              Usar mi ubicación
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Radius>
            ariaLabel="Radio de búsqueda"
            value={radius}
            onChange={(value) => {
              setRadius(value);
              setSelectedId(null);
            }}
            options={[
              { value: "10", label: "10 km" },
              { value: "25", label: "25 km" },
              { value: "50", label: "50 km" },
            ]}
          />
          <Segmented<View>
            ariaLabel="Fuente del mapa"
            value={view}
            onChange={setView}
            options={[
              { value: "tecla", label: "Mapa TECLA" },
              { value: "plugshare", label: "PlugShare" },
            ]}
          />
        </div>
      </div>

      {view === "plugshare" ? (
        <PlugShareMap center={origin} radiusKm={Number(radius)} height={mapHeight} sourceLabel={originLabel} />
      ) : (
        <div className={cn("grid gap-4", compact ? "lg:grid-cols-[320px_minmax(0,1fr)]" : "lg:grid-cols-[380px_minmax(0,1fr)]")}>
          <div className="flex min-h-0 flex-col rounded-[1.6rem] border border-border bg-surface/40" style={{ maxHeight: mapHeight }}>
            <div className="border-b border-border px-4 py-2.5 text-[11px] text-muted">
              {stations.isLoading ? "Buscando estaciones…" : stations.isError ? "Sin estaciones" : `${list.length} estaciones en ${radius} km · toca una para ver la ruta`}
            </div>
            {!configured ? (
              <p className="p-4 text-sm leading-relaxed text-muted">
                Las estaciones no están configuradas en el servidor (falta la clave gratuita de Open Charge Map). Mientras tanto puedes usar la vista PlugShare.
              </p>
            ) : stations.isError ? (
              <p className="p-4 text-sm text-amber-300/90">{errorMessage(stations.error)}</p>
            ) : stations.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : list.length === 0 ? (
              <p className="p-4 text-sm text-muted">No hay estaciones registradas en {radius} km. Amplía el radio o prueba la vista PlugShare.</p>
            ) : (
              <ul ref={listRef} className="ai-scroll min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {list.map((station) => (
                  <StationRow key={station.id} station={station} selected={station.id === selectedId} onSelect={() => setSelectedId(station.id === selectedId ? null : station.id)} />
                ))}
              </ul>
            )}
          </div>

          <div className="relative overflow-hidden rounded-[1.6rem] border border-border bg-black/40" style={{ height: mapHeight }}>
            <ChargersMap origin={origin} originKind={originKind} stations={list} selectedId={selectedId} route={route.data?.route ?? null} onSelect={setSelectedId} className="size-full" />
            {selected ? (
              <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-border bg-[var(--glass-strong)] p-3 shadow-[var(--shadow-float)] backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                      {route.isLoading ? (
                        <span className="flex items-center gap-1"><Route className="size-3" aria-hidden />Calculando ruta…</span>
                      ) : route.data?.route ? (
                        <>
                          <span className="flex items-center gap-1"><Route className="size-3" aria-hidden />{route.data.route.distanceKm} km por carretera</span>
                          <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />{route.data.route.durationMin} min aprox.</span>
                        </>
                      ) : (
                        <span>Ruta no disponible ahora; se muestra la línea recta{selected.distanceKm !== null ? ` (${selected.distanceKm} km)` : ""}.</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={buildWazeRouteUrl({ latitude: selected.latitude, longitude: selected.longitude })} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground">
                      <Navigation className="size-3.5" aria-hidden />
                      Ir con Waze
                    </a>
                    <a href={buildGoogleMapsRouteUrl(`${selected.latitude},${selected.longitude}`)} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium">
                      Google Maps
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        {view === "tecla"
          ? "Estaciones: Open Charge Map (CC BY 4.0, datos comunitarios: verifica disponibilidad antes de ir). Mapa: © OpenStreetMap. Rutas: OSRM (servidor público, sin garantías). Las coordenadas se envían a esos servicios para dibujar el mapa y la ruta; TECLA no las guarda."
          : "Mapa de PlugShare con su widget oficial; las coordenadas del centro se envían a PlugShare. El contenido es de PlugShare y sus usuarios."}
      </p>
    </div>
  );
}

function StationRow({ station, selected, onSelect }: { station: ChargingStation; selected: boolean; onSelect: () => void }) {
  const tier = powerTier(station.maxPowerKw);
  const connectors = Array.from(new Set(station.connectors.map((connector) => connector.type))).slice(0, 3);
  return (
    <li data-station={station.id}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors", selected ? "bg-accent/10" : "hover:bg-surface/70")}
      >
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", tier === "fast" ? "bg-amber-500/15 text-amber-400" : tier === "medium" ? "bg-emerald-500/15 text-emerald-400" : "bg-surface text-muted")}>
          {tier === "fast" ? <Zap className="size-4" aria-hidden /> : <Plug className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{station.name}</span>
            {station.distanceKm !== null ? <span className="shrink-0 text-[11px] tabular-nums text-muted">{station.distanceKm} km</span> : null}
          </span>
          <span className="block truncate text-[11px] text-muted">{[station.address, station.town].filter(Boolean).join(", ") || station.operator || "Dirección no registrada"}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={TIER_VARIANT[tier]}>{station.maxPowerKw !== null ? `${station.maxPowerKw} kW · ${TIER_LABEL[tier]}` : TIER_LABEL[tier]}</Badge>
            {connectors.map((type) => (
              <Badge key={type} variant="outline">{type}</Badge>
            ))}
            {station.operational === false ? <Badge variant="live">Fuera de servicio</Badge> : null}
            {station.points ? <span className="text-[10px] text-muted">{station.points} puntos</span> : null}
          </span>
        </span>
      </button>
    </li>
  );
}
