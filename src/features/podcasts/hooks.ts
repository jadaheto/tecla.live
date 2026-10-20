"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { PodcastEpisode } from "@/types";

interface PodcastSearchResponse {
  episodes: PodcastEpisode[];
  query: string;
}

export function usePodcastSearch(query: string, limit = 18) {
  return useQuery({
    queryKey: ["podcast-search", query.trim(), limit],
    queryFn: () =>
      apiFetch<PodcastSearchResponse>(
        `/api/podcasts/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
      ),
    enabled: query.trim().length >= 2,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
