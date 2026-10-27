"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { ChargingStation } from "@/lib/integrations/open-charge-map";
import type { DrivingRoute } from "@/lib/integrations/routing";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function useChargingStations(center: GeoPoint | null, radiusKm: number, enabled = true) {
  const lat = center ? Number(center.latitude.toFixed(3)) : null;
  const lon = center ? Number(center.longitude.toFixed(3)) : null;
  return useQuery({
    queryKey: ["chargers", lat, lon, radiusKm],
    queryFn: () => apiFetch<{ stations: ChargingStation[]; attribution: string }>(`/api/chargers?lat=${lat}&lon=${lon}&radius=${radiusKm}&max=40`),
    enabled: enabled && lat !== null && lon !== null,
    staleTime: 10 * 60_000,
    retry: 0,
  });
}

export function useDrivingRoute(from: GeoPoint | null, to: GeoPoint | null) {
  return useQuery({
    queryKey: ["route", from?.latitude.toFixed(4), from?.longitude.toFixed(4), to?.latitude.toFixed(4), to?.longitude.toFixed(4)],
    queryFn: () =>
      apiFetch<{ route: DrivingRoute | null; attribution: string }>(
        `/api/route?fromLat=${from?.latitude}&fromLon=${from?.longitude}&toLat=${to?.latitude}&toLon=${to?.longitude}`,
      ),
    enabled: Boolean(from && to),
    staleTime: 10 * 60_000,
    retry: 0,
  });
}

export type { ChargingStation, DrivingRoute };
