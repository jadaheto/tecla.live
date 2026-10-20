import { z } from "zod";
import { parseIsoDuration } from "@/lib/duration";
import type { YouTubeVideo } from "@/types";

const ThumbnailSchema = z
  .object({
    url: z.string().url(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .optional();

const VideoItemSchema = z.object({
  id: z.union([z.string(), z.object({ videoId: z.string() })]),
  snippet: z.object({
    title: z.string(),
    description: z.string().optional().default(""),
    channelId: z.string().optional(),
    channelTitle: z.string().optional(),
    publishedAt: z.string().optional(),
    liveBroadcastContent: z.enum(["none", "live", "upcoming"]).optional().default("none"),
    thumbnails: z
      .object({
        default: ThumbnailSchema,
        medium: ThumbnailSchema,
        high: ThumbnailSchema,
        standard: ThumbnailSchema,
        maxres: ThumbnailSchema,
      })
      .optional(),
  }),
  contentDetails: z
    .object({
      duration: z.string().optional(),
    })
    .optional(),
  status: z
    .object({
      embeddable: z.boolean().optional(),
      privacyStatus: z.string().optional(),
    })
    .optional(),
});

const SearchResponseSchema = z.object({
  items: z.array(VideoItemSchema).default([]),
});

const ListResponseSchema = z.object({
  items: z.array(VideoItemSchema).default([]),
});

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const globalCache = globalThis as unknown as {
  __teclaYouTubeCache?: Map<string, CacheEntry>;
  __teclaYouTubeInflight?: Map<string, Promise<unknown>>;
};

function cache(): Map<string, CacheEntry> {
  if (!globalCache.__teclaYouTubeCache) globalCache.__teclaYouTubeCache = new Map();
  return globalCache.__teclaYouTubeCache;
}

function inflight(): Map<string, Promise<unknown>> {
  if (!globalCache.__teclaYouTubeInflight) globalCache.__teclaYouTubeInflight = new Map();
  return globalCache.__teclaYouTubeInflight;
}

export class YouTubeError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 502, retryable = true) {
    super(message);
    this.name = "YouTubeError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function pickThumbnail(snippet: z.infer<typeof VideoItemSchema>["snippet"]): string {
  const thumbs = snippet.thumbnails;
  return (
    thumbs?.maxres?.url ??
    thumbs?.standard?.url ??
    thumbs?.high?.url ??
    thumbs?.medium?.url ??
    thumbs?.default?.url ??
    ""
  );
}

function toVideo(item: z.infer<typeof VideoItemSchema>): YouTubeVideo {
  const id = typeof item.id === "string" ? item.id : item.id.videoId;
  return {
    id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnail: pickThumbnail(item.snippet),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    liveBroadcastContent: item.snippet.liveBroadcastContent,
    ...(item.status?.embeddable === undefined
      ? {}
      : { embeddable: item.status.embeddable }),
  };
}

async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cache().get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = inflight().get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((value) => {
      cache().set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight().delete(key);
    });

  inflight().set(key, promise);
  return promise;
}

export interface YouTubeClientConfig {
  apiKey: string;
}

export function createYouTubeClient(config: YouTubeClientConfig) {
  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("key", config.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new YouTubeError(
        "YOUTUBE_UNREACHABLE",
        "No pudimos conectar con YouTube. Intenta de nuevo.",
        503,
        true,
      );
    }

    if (response.status === 403 || response.status === 429) {
      let reason = "";
      try {
        const body = (await response.json()) as { error?: { errors?: Array<{ reason?: string }> } };
        reason = body.error?.errors?.[0]?.reason ?? "";
      } catch {
        // sin cuerpo útil
      }
      if (reason.includes("quota") || reason === "rateLimitExceeded") {
        throw new YouTubeError(
          "YOUTUBE_QUOTA_EXCEEDED",
          "La cuota de YouTube se agotó por ahora. Puedes seguir usando el resto de TECLA LIVE.",
          429,
          false,
        );
      }
      throw new YouTubeError(
        "YOUTUBE_FORBIDDEN",
        "YouTube rechazó la solicitud. Revisa la configuración de la API.",
        502,
        false,
      );
    }

    if (!response.ok) {
      throw new YouTubeError(
        "YOUTUBE_UPSTREAM_ERROR",
        "YouTube no está disponible en este momento.",
        502,
        true,
      );
    }

    return response.json();
  }

  return {
    async search(input: {
      query: string;
      limit: number;
      region: string;
      order?: "relevance" | "date" | "viewCount";
    }): Promise<YouTubeVideo[]> {
      const key = `search:${input.region}:${input.limit}:${input.order ?? "relevance"}:${input.query.toLowerCase()}`;
      return cached(key, 5 * 60_000, async () => {
        const requested = Math.min(50, Math.max(input.limit * 2, input.limit + 4));
        const raw = await request("search", {
          part: "snippet",
          type: "video",
          maxResults: String(requested),
          q: input.query,
          regionCode: input.region,
          relevanceLanguage: "es",
          safeSearch: "moderate",
          ...(input.order ? { order: input.order } : {}),
        });
        const parsed = SearchResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw new YouTubeError(
            "YOUTUBE_INVALID_RESPONSE",
            "YouTube devolvió una respuesta inesperada.",
            502,
            true,
          );
        }
        const videos = parsed.data.items
          .filter((item) => (typeof item.id === "string" ? item.id : item.id.videoId))
          .map(toVideo);

        // Para búsquedas de artistas, el canal oficial suele ser el resultado
        // más fiable y el que permite reproducción incrustada. Es solo un
        // orden preferente: no se elimina ningún resultado por su canal.
        const normalizedQuery = input.query.trim().toLowerCase();
        const channelRank = (video: YouTubeVideo) => {
          const channel = (video.channelTitle ?? "").trim().toLowerCase();
          if (!channel) return 3;
          if (channel === normalizedQuery) return 0;
          if (normalizedQuery.includes(channel)) return 1;
          if (channel.includes(normalizedQuery)) return 2;
          return 3;
        };
        const ordered = [...videos].sort((a, b) => channelRank(a) - channelRank(b));

        const ids = videos.map((video) => video.id);
        if (ids.length > 0) {
          try {
            const detailsRaw = await request("videos", {
              part: "contentDetails,snippet,statistics,status",
              id: ids.join(","),
              maxResults: String(ids.length),
            });
            const details = ListResponseSchema.safeParse(detailsRaw);
            if (details.success) {
              const byId = new Map(details.data.items.map((item) => [toVideo(item).id, toVideo(item)]));
              return ordered
                .map((video) => ({
                  ...video,
                  durationSeconds: byId.get(video.id)?.durationSeconds ?? video.durationSeconds,
                  thumbnail: byId.get(video.id)?.thumbnail || video.thumbnail,
                  embeddable: byId.get(video.id)?.embeddable ?? video.embeddable,
                }))
                .filter((video) => video.embeddable !== false)
                .slice(0, input.limit);
            }
          } catch {
            // La búsqueda ya es útil aunque no se obtengan detalles.
          }
        }
        return ordered.filter((video) => video.embeddable !== false).slice(0, input.limit);
      });
    },

    async trending(input: { region: string; limit: number }): Promise<YouTubeVideo[]> {
      const key = `trending:${input.region}:${input.limit}`;
      return cached(key, 15 * 60_000, async () => {
        const raw = await request("videos", {
          part: "snippet,contentDetails,statistics,status",
          chart: "mostPopular",
          regionCode: input.region,
          maxResults: String(Math.min(50, Math.max(input.limit * 2, input.limit + 4))),
        });
        const parsed = ListResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw new YouTubeError(
            "YOUTUBE_INVALID_RESPONSE",
            "YouTube devolvió una respuesta inesperada.",
            502,
            true,
          );
        }
        return parsed.data.items
          .map(toVideo)
          .filter((video) => video.id && video.embeddable !== false)
          .slice(0, input.limit);
      });
    },

    async video(id: string): Promise<YouTubeVideo | null> {
      return cached(`video:${id}`, 10 * 60_000, async () => {
        const raw = await request("videos", {
          part: "snippet,contentDetails,statistics,status",
          id,
          maxResults: "1",
        });
        const parsed = ListResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw new YouTubeError(
            "YOUTUBE_INVALID_RESPONSE",
            "YouTube devolvió una respuesta inesperada.",
            502,
            true,
          );
        }
        const first = parsed.data.items[0];
        return first ? toVideo(first) : null;
      });
    },
  };
}

export type YouTubeClient = ReturnType<typeof createYouTubeClient>;
