"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { TeslaSnapshot } from "@/lib/integrations/tesla";

export interface TeslaStatus {
  configured: boolean;
  authenticated: boolean;
  connected: boolean;
  domain: string;
  region: "na" | "eu";
  account?: { scope: string | null; updatedAt: string } | null;
}

export function useTeslaStatus() {
  return useQuery({
    queryKey: ["tesla-status"],
    queryFn: () => apiFetch<TeslaStatus>("/api/tesla/status"),
    staleTime: 60_000,
    retry: 0,
  });
}

/** Lectura del vehículo; el servidor reutiliza su caché 2 minutos, así que sondear más seguido no cuesta más. */
export function useTeslaVehicle(enabled: boolean) {
  return useQuery({
    queryKey: ["tesla-vehicle"],
    queryFn: () => apiFetch<TeslaSnapshot>("/api/tesla/vehicle"),
    enabled,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 0,
  });
}

export type { TeslaSnapshot };

export function chargingLabel(snapshot: TeslaSnapshot): string {
  switch (snapshot.charging) {
    case "charging":
      return snapshot.minutesToFull !== null && snapshot.minutesToFull > 0
        ? `Cargando · ${snapshot.minutesToFull >= 60 ? `${Math.floor(snapshot.minutesToFull / 60)} h ${snapshot.minutesToFull % 60} min` : `${snapshot.minutesToFull} min`} para ${snapshot.chargeLimitPercent ?? 100}%`
        : "Cargando";
    case "complete":
      return "Carga completa";
    case "stopped":
      return "Carga detenida";
    case "no_power":
      return "Conectado sin energía";
    case "disconnected":
      return "Desconectado del cargador";
    default:
      return snapshot.asleep ? "Durmiendo" : "Estado desconocido";
  }
}

import type { TeslaChargingSession, TeslaChargingSite, TeslaDetail } from "@/lib/integrations/tesla";

export interface TeslaDetailResponse {
  summary: TeslaSnapshot;
  detail: TeslaDetail | null;
}

export function useTeslaDetail(enabled: boolean) {
  return useQuery({
    queryKey: ["tesla-detail"],
    queryFn: () => apiFetch<TeslaDetailResponse>("/api/tesla/detail"),
    enabled,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
    retry: 0,
  });
}

export function useTeslaChargers(enabled: boolean) {
  return useQuery({
    queryKey: ["tesla-chargers"],
    queryFn: () => apiFetch<{ superchargers: TeslaChargingSite[]; destinations: TeslaChargingSite[]; asleep: boolean }>("/api/tesla/chargers"),
    enabled,
    staleTime: 10 * 60_000,
    retry: 0,
  });
}

export function useTeslaChargingHistory(enabled: boolean) {
  return useQuery({
    queryKey: ["tesla-charging-history"],
    queryFn: () => apiFetch<{ sessions: TeslaChargingSession[] }>("/api/tesla/charging-history"),
    enabled,
    staleTime: 30 * 60_000,
    retry: 0,
  });
}

export type { TeslaChargingSession, TeslaChargingSite, TeslaDetail };
