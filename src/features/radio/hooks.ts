"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { RadioStation } from "@/types";

interface RadioResponse {
  stations: RadioStation[];
  query: string;
  country: string;
}

export function useRadioStations(query = "", limit = 24, enabled = true) {
  return useQuery({
    queryKey: ["radio-stations", query.trim(), limit],
    queryFn: () =>
      apiFetch<RadioResponse>(
        `/api/radio/stations?limit=${limit}&country=CO${
          query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""
        }`,
      ),
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useRadioStation(id: string | null) {
  return useQuery({
    queryKey: ["radio-station", id],
    queryFn: () =>
      apiFetch<{ station: RadioStation }>(`/api/radio/station?id=${encodeURIComponent(id ?? "")}`),
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
