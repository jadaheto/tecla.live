"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http";
import type { YouTubeSearchResult, YouTubeVideo } from "@/types";

interface VideoResponse {
  video: YouTubeVideo;
}

interface TrendingResponse {
  videos: YouTubeVideo[];
  configured: boolean;
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useYouTubeSearch(query: string, limit = 12, enabled = true) {
  const debounced = useDebouncedValue(query.trim(), 400);
  const shouldFetch = enabled && debounced.length >= 2;

  return useQuery({
    queryKey: ["youtube-search", debounced, limit],
    queryFn: () =>
      apiFetch<YouTubeSearchResult>(
        `/api/youtube/search?q=${encodeURIComponent(debounced)}&limit=${limit}&region=CO`,
      ),
    enabled: shouldFetch,
    staleTime: 5 * 60_000,
    retry: 0,
  });
}

export function useYouTubeTrending(limit = 12) {
  return useQuery({
    queryKey: ["youtube-trending", limit],
    queryFn: () =>
      apiFetch<TrendingResponse>(`/api/youtube/trending?limit=${limit}&region=CO`),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useYouTubeVideo(id: string | null) {
  return useQuery({
    queryKey: ["youtube-video", id],
    queryFn: () => apiFetch<VideoResponse>(`/api/youtube/video?id=${id}`),
    enabled: Boolean(id && /^[A-Za-z0-9_-]{6,20}$/.test(id)),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
