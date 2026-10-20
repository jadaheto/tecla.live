import { z } from "zod";
import type { PodcastEpisode } from "@/types";

const ItunesResultSchema = z.object({
  trackId: z.number().optional(),
  trackName: z.string().optional(),
  collectionName: z.string().optional(),
  description: z.string().optional(),
  artworkUrl600: z.string().optional(),
  artworkUrl160: z.string().optional(),
  previewUrl: z.string().optional(),
  trackTimeMillis: z.number().optional(),
  releaseDate: z.string().optional(),
  feedUrl: z.string().optional(),
  collectionViewUrl: z.string().optional(),
});

const ItunesResponseSchema = z.object({
  resultCount: z.number().optional(),
  results: z.array(ItunesResultSchema).default([]),
});

export class PodcastError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "PodcastError";
    this.code = code;
    this.status = status;
  }
}

interface CacheEntry {
  value: PodcastEpisode[];
  expiresAt: number;
}

const globalCache = globalThis as unknown as { __teclaPodcastCache?: Map<string, CacheEntry> };

function cache(): Map<string, CacheEntry> {
  if (!globalCache.__teclaPodcastCache) globalCache.__teclaPodcastCache = new Map();
  return globalCache.__teclaPodcastCache;
}

export async function fetchPodcastEpisodes(input: {
  query: string;
  limit?: number;
}): Promise<PodcastEpisode[]> {
  const query = input.query.trim();
  if (!query) return [];
  const limit = Math.min(25, Math.max(1, input.limit ?? 12));
  const key = `${limit}:${query.toLowerCase()}`;
  const hit = cache().get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcastEpisode");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "CO");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "TECLA-LIVE/0.1" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new PodcastError(
      "PODCASTS_UNREACHABLE",
      "No pudimos conectar con el directorio de podcasts.",
      503,
    );
  }

  if (!response.ok) {
    throw new PodcastError(
      "PODCASTS_UPSTREAM_ERROR",
      "El directorio de podcasts no está disponible.",
      response.status === 429 ? 429 : 502,
    );
  }

  const parsed = ItunesResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new PodcastError(
      "PODCASTS_INVALID_RESPONSE",
      "El directorio de podcasts devolvió una respuesta inesperada.",
    );
  }

  const episodes = parsed.data.results
    .filter((item) => item.previewUrl && item.trackName)
    .map((item, index) => ({
      id: String(item.trackId ?? `${query}-${index}`),
      title: item.trackName ?? "Episodio",
      podcastTitle: item.collectionName ?? "Podcast",
      description: item.description,
      imageUrl: item.artworkUrl600 ?? item.artworkUrl160,
      audioUrl: item.previewUrl,
      durationSeconds: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : undefined,
      publishedAt: item.releaseDate,
      feedUrl: item.feedUrl ?? item.collectionViewUrl,
      externalUrl: item.collectionViewUrl,
    }));

  cache().set(key, { value: episodes, expiresAt: Date.now() + 10 * 60_000 });
  return episodes;
}
