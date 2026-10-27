"use client";

import * as React from "react";
import { ExternalLink, MapPinned } from "lucide-react";
import { PLUGSHARE_SITE_URL, plugShareWidgetUrl, type PlugShareCenter } from "@/features/charging/plugshare";
import { cn } from "@/lib/utils";

/**
 * Widget oficial de PlugShare dentro de TECLA LIVE. Centrado en la posición
 * que se le pase (auto, navegador o ubicación configurada); sin centro, el
 * widget pide la ubicación al navegador (por eso `allow="geolocation"`).
 * Las coordenadas viajan a PlugShare en la URL del mapa: se declara en pantalla.
 */
export function PlugShareMap({
  center,
  radiusKm = 25,
  height = 620,
  sourceLabel,
  className,
}: {
  center: PlugShareCenter | null;
  radiusKm?: number;
  height?: number;
  sourceLabel?: string;
  className?: string;
}) {
  const url = React.useMemo(() => plugShareWidgetUrl(center, radiusKm), [center, radiusKm]);
  const [loaded, setLoaded] = React.useState(false);

  return (
    <div className={cn("overflow-hidden rounded-[1.6rem] border border-border bg-black/40", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <MapPinned className="size-3.5" aria-hidden />
          Mapa de PlugShare{sourceLabel ? ` · centrado en ${sourceLabel}` : ""}{center ? ` · radio ${radiusKm} km` : ""}
        </span>
        <a href={PLUGSHARE_SITE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-accent hover:underline">
          Abrir PlugShare
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
      <div className="relative" style={{ height }}>
        {!loaded ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted" aria-hidden>
            Cargando mapa de PlugShare…
          </div>
        ) : null}
        <iframe
          key={url}
          src={url}
          title="Estaciones de carga cercanas (PlugShare)"
          className="relative size-full border-0"
          allow="geolocation"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}
