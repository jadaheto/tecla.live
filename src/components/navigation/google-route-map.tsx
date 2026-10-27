"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { LocateFixed, Map, TriangleAlert } from "lucide-react";
import { buildGoogleMapsEmbedDirectionsUrl, buildGoogleMapsEmbedPlaceUrl, metersBetween, type EmbedPlace, type EmbedPoint } from "@/lib/integrations/google-maps-embed";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";

export function useMapsEmbedKey() {
  return useQuery({
    queryKey: ["maps-embed-key"],
    queryFn: () => apiFetch<{ configured: boolean; key: string | null }>("/api/maps/embed-key"),
    staleTime: 60 * 60_000,
    retry: 0,
  });
}

const FOLLOW_MIN_METERS = 150;
const FOLLOW_MIN_MS = 45_000;

/**
 * Ruta de Google dentro de TECLA (Maps Embed API, modo directions). Con
 * «Seguir mi posición», el origen se actualiza con el GPS del navegador
 * cuando te mueves más de 150 m (como mucho cada 45 s) y la ruta se redibuja.
 * No es guía por voz: es el mapa de Google con el trayecto y el tráfico.
 */
export function GoogleRouteMap({
  destination,
  origin,
  height = 460,
  className,
  onOriginChange,
}: {
  destination: EmbedPlace;
  origin: EmbedPlace | null;
  height?: number;
  className?: string;
  /** Posición en vivo del seguimiento, por si la pantalla quiere mostrarla. */
  onOriginChange?: (point: EmbedPoint) => void;
}) {
  const keyQuery = useMapsEmbedKey();
  const key = keyQuery.data?.key ?? null;
  const [follow, setFollow] = React.useState(false);
  const [live, setLive] = React.useState<EmbedPoint | null>(null);
  const [followError, setFollowError] = React.useState<string | null>(null);
  const lastRef = React.useRef<{ point: EmbedPoint; at: number } | null>(null);
  const changeRef = React.useRef(onOriginChange);
  React.useEffect(() => {
    changeRef.current = onOriginChange;
  }, [onOriginChange]);

  function toggleFollow() {
    if (follow) {
      setFollow(false);
      setLive(null);
      lastRef.current = null;
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setFollowError("Este navegador no ofrece ubicación.");
      return;
    }
    setFollowError(null);
    setFollow(true);
  }

  React.useEffect(() => {
    if (!follow || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const last = lastRef.current;
        const now = Date.now();
        if (last && now - last.at < FOLLOW_MIN_MS && metersBetween(last.point, point) < FOLLOW_MIN_METERS) return;
        lastRef.current = { point, at: now };
        setLive(point);
        setFollowError(null);
        changeRef.current?.(point);
      },
      () => setFollowError("No pudimos leer tu ubicación. Revisa el permiso del navegador."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [follow]);

  const effectiveOrigin = live ?? origin;
  const url = React.useMemo(() => {
    if (!key) return null;
    return effectiveOrigin ? buildGoogleMapsEmbedDirectionsUrl({ key, origin: effectiveOrigin, destination }) : buildGoogleMapsEmbedPlaceUrl({ key, place: destination });
  }, [key, effectiveOrigin, destination]);

  if (keyQuery.isLoading) {
    return <div className={cn("animate-pulse rounded-[2rem] border border-border bg-surface/40", className)} style={{ height }} aria-hidden />;
  }

  if (!key) {
    return (
      <div className={cn("flex flex-col justify-center gap-2 rounded-[2rem] border border-dashed border-border bg-surface/30 p-6 text-sm text-muted", className)} style={{ minHeight: 200 }}>
        <p className="flex items-center gap-2 font-medium text-foreground">
          <TriangleAlert className="size-4 text-amber-400" aria-hidden />
          El mapa de ruta dentro de TECLA no está configurado.
        </p>
        <p className="text-[12px] leading-relaxed">
          Falta la clave del Maps Embed API de Google (<code className="font-mono text-[11px]">GOOGLE_MAPS_EMBED_KEY</code>). Mientras tanto, los botones de abajo abren la ruta en Waze o Google Maps.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-[2rem] border border-border bg-black/40", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Map className="size-3.5" aria-hidden />
          {effectiveOrigin ? "Ruta de Google dentro de TECLA · tráfico en vivo" : "Destino en Google Maps · sin origen todavía"}
        </span>
        <button
          type="button"
          onClick={toggleFollow}
          aria-pressed={follow}
          className={cn("flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors", follow ? "border-accent bg-accent/15 text-accent" : "border-border text-foreground hover:bg-surface")}
        >
          <LocateFixed className="size-3.5" aria-hidden />
          {follow ? "Siguiendo tu posición" : "Seguir mi posición"}
        </button>
      </div>
      {followError ? <p className="px-4 py-2 text-[11px] text-amber-300/90">{followError}</p> : null}
      <iframe
        key={url ?? "none"}
        src={url ?? undefined}
        title="Ruta en Google Maps dentro de TECLA LIVE"
        className="block w-full border-0"
        style={{ height }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
