"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { WeatherSnapshot } from "@/types";
import { usePreferences } from "@/stores/preferences";

export function useWeather() {
  const lat = usePreferences((state) => state.weatherLat);
  const lon = usePreferences((state) => state.weatherLon);
  const location = usePreferences((state) => state.weatherLocation);

  return useQuery({
    queryKey: ["weather", lat, lon, location],
    queryFn: () =>
      apiFetch<WeatherSnapshot>(
        `/api/weather?lat=${lat}&lon=${lon}&location=${encodeURIComponent(location)}`,
      ),
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}

export interface IntegrationsStatus {
  integrations: {
    youtube: boolean;
    deepseek: boolean;
    deepgram: boolean;
    elevenlabs: boolean;
    spotify: boolean;
    tesla: boolean;
    chargers: boolean;
    database: boolean;
    auth: boolean;
  };
  free: Record<string, boolean>;
  models: {
    deepseek: string | null;
    deepgram: string | null;
    elevenlabs: string | null;
  };
  limits: {
    maxToolSteps: number;
    maxTtsChars: number;
    maxAudioSeconds: number;
    monthlyBudgetUsd: number;
  };
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations-status"],
    queryFn: () => apiFetch<IntegrationsStatus>("/api/integrations/status"),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
