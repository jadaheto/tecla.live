"use client";

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { powerTier, type ChargingStation } from "@/lib/integrations/open-charge-map";
import type { DrivingRoute } from "@/lib/integrations/routing";
import { usePreferences } from "@/stores/preferences";
import type { GeoPoint } from "@/features/charging/hooks";

const TIER_COLOR: Record<ReturnType<typeof powerTier>, string> = {
  fast: "#f59e0b",
  medium: "#34d399",
  slow: "#60a5fa",
  unknown: "#9ca3af",
};

function stationIcon(station: ChargingStation, selected: boolean): L.DivIcon {
  const color = TIER_COLOR[powerTier(station.maxPowerKw)];
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "chargers-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<span class="chargers-marker__pin${selected ? " is-selected" : ""}" style="--pin:${color}"><i></i></span>`,
  });
}

function originIcon(kind: "car" | "device"): L.DivIcon {
  return L.divIcon({
    className: "chargers-marker",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span class="chargers-origin chargers-origin--${kind}"></span>`,
  });
}

/**
 * Mapa propio de TECLA (Leaflet + OpenStreetMap): estaciones de Open Charge
 * Map coloreadas por potencia, el origen (auto o dispositivo) y la ruta
 * elegida. El tema oscuro invierte los mosaicos para que combinen con la app.
 */
export function ChargersMap({
  origin,
  originKind,
  stations,
  selectedId,
  route,
  onSelect,
  className,
}: {
  origin: GeoPoint | null;
  originKind: "car" | "device";
  stations: ChargingStation[];
  selectedId: string | null;
  route: DrivingRoute | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const layerRef = React.useRef<L.LayerGroup | null>(null);
  const routeRef = React.useRef<L.Polyline | null>(null);
  const originRef = React.useRef<L.Marker | null>(null);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const selectRef = React.useRef(onSelect);
  React.useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    const map = L.map(host, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, tap: true } as L.MapOptions);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    map.setView([origin?.latitude ?? 4.65, origin?.longitude ?? -74.08], 12);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // El mapa se crea una vez; los cambios se aplican en los efectos siguientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Origen.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    originRef.current?.remove();
    originRef.current = null;
    if (!origin) return;
    originRef.current = L.marker([origin.latitude, origin.longitude], { icon: originIcon(originKind), interactive: false, zIndexOffset: 500 }).addTo(map);
  }, [origin, originKind]);

  // Estaciones.
  React.useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const station of stations) {
      const marker = L.marker([station.latitude, station.longitude], { icon: stationIcon(station, station.id === selectedId), title: station.name });
      marker.on("click", () => selectRef.current(station.id));
      marker.addTo(layer);
    }
    if (!selectedId && stations.length > 0) {
      const points: L.LatLngExpression[] = stations.map((station) => [station.latitude, station.longitude]);
      if (origin) points.push([origin.latitude, origin.longitude]);
      map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: !reduceMotion, maxZoom: 14 });
    }
  }, [stations, selectedId, origin, reduceMotion]);

  // Ruta.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    routeRef.current?.remove();
    routeRef.current = null;
    const target = stations.find((station) => station.id === selectedId);
    if (!target) return;
    const line: L.LatLngExpression[] = route ? route.geometry : origin ? [[origin.latitude, origin.longitude], [target.latitude, target.longitude]] : [];
    if (line.length < 2) {
      map.setView([target.latitude, target.longitude], 15, { animate: !reduceMotion });
      return;
    }
    routeRef.current = L.polyline(line, { color: "#ff5a3c", weight: 5, opacity: 0.9, dashArray: route ? undefined : "8 10" }).addTo(map);
    map.fitBounds(routeRef.current.getBounds().pad(0.2), { animate: !reduceMotion });
  }, [route, selectedId, stations, origin, reduceMotion]);

  return <div ref={hostRef} className={className} role="application" aria-label="Mapa de estaciones de carga" />;
}
