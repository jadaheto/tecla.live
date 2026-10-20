import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { publicConfig } from "@/lib/public-config";
import { createYouTubeClient } from "@/lib/integrations/youtube";
import { fetchRadioStations } from "@/lib/integrations/radio";
import { fetchPodcastEpisodes } from "@/lib/integrations/podcasts";
import { fetchWeather, fetchWeatherForLocation } from "@/lib/integrations/weather";
import { TOOL_SCHEMAS, type ToolName } from "@/features/ai/tools/schemas";
import { logger } from "@/lib/logger";
import { controlSpotify, SpotifyError } from "@/lib/integrations/spotify";

export interface ServerToolResult {
  ok: boolean;
  content: string;
}

export interface ServerToolContext {
  userId: string | null;
  sessionId: string;
}

function serialize(value: unknown): string {
  const json = JSON.stringify(value);
  return json.length > 8000 ? `${json.slice(0, 8000)}…` : json;
}

function failure(code: string, message: string): ServerToolResult {
  return { ok: false, content: serialize({ ok: false, error: { code, message } }) };
}

export async function executeServerTool(
  name: ToolName,
  args: unknown,
  context: ServerToolContext,
): Promise<ServerToolResult> {
  try {
    switch (name) {
      case "search_youtube": {
        const input = TOOL_SCHEMAS.search_youtube.parse(args);
        if (!serverConfig.youtubeApiKey) {
          return failure(
            "YOUTUBE_NOT_CONFIGURED",
            "YouTube no está configurado en TECLA LIVE. No hay resultados disponibles. Ofrece una alternativa manual.",
          );
        }
        const client = createYouTubeClient({ apiKey: serverConfig.youtubeApiKey });
        const videos = await client.search({
          query: input.query,
          limit: input.limit,
          region: input.region,
        });
        return {
          ok: true,
          content: serialize({
            ok: true,
            query: input.query,
            results: videos.map((video) => ({
              videoId: video.id,
              title: video.title,
              channel: video.channelTitle,
              durationSeconds: video.durationSeconds,
              publishedAt: video.publishedAt,
              live: video.liveBroadcastContent === "live",
            })),
          }),
        };
      }

      case "search_radio": {
        const input = TOOL_SCHEMAS.search_radio.parse(args);
        const stations = await fetchRadioStations({
          query: input.query,
          limit: input.limit,
          countryCode: "CO",
        });
        return {
          ok: true,
          content: serialize({
            ok: true,
            stations: stations.map((station) => ({
              stationId: station.id,
              name: station.name,
              tags: station.tags,
              country: station.country,
              bitrate: station.bitrate,
            })),
          }),
        };
      }

      case "search_podcasts": {
        const input = TOOL_SCHEMAS.search_podcasts.parse(args);
        const episodes = await fetchPodcastEpisodes({
          query: input.query,
          limit: input.limit,
        });
        return {
          ok: true,
          content: serialize({
            ok: true,
            episodes: episodes.map((episode) => ({
              episodeId: episode.id,
              title: episode.title,
              podcast: episode.podcastTitle,
              durationSeconds: episode.durationSeconds,
              publishedAt: episode.publishedAt,
            })),
          }),
        };
      }

      case "get_weather": {
        const input = TOOL_SCHEMAS.get_weather.parse(args);
        const snapshot = input.location
          ? await fetchWeatherForLocation(input.location)
          : await fetchWeather({
              lat: publicConfig.weatherLat,
              lon: publicConfig.weatherLon,
              location: publicConfig.weatherLocation,
            });
        return {
          ok: true,
          content: serialize({
            ok: true,
            weather: {
              location: snapshot.location,
              temperatureC: snapshot.temperature,
              feelsLikeC: snapshot.apparentTemperature,
              condition: snapshot.label,
              humidityPercent: snapshot.humidity,
              windKmh: snapshot.windSpeed,
              observedAt: snapshot.updatedAt,
            },
          }),
        };
      }

      case "spotify_control": {
        const input = TOOL_SCHEMAS.spotify_control.parse(args);
        if (!context.userId) {
          return failure(
            "AUTH_REQUIRED",
            "Para controlar Spotify necesitas iniciar sesión y vincular tu cuenta. Abre Música para hacerlo.",
          );
        }
        try {
          const result = await controlSpotify(context.userId, input.action, input.volume);
          return {
            ok: true,
            content: serialize({
              ok: true,
              action: result.action,
              deviceId: result.deviceId,
              message: "Spotify ejecutó la acción en el dispositivo activo.",
            }),
          };
        } catch (error) {
          if (error instanceof SpotifyError) {
            return failure(error.code, error.message);
          }
          throw error;
        }
      }

      default: {
        logger.warn("ai.server_tool_unknown", { name });
        return failure("TOOL_NOT_AVAILABLE", "Esa herramienta no está disponible en el servidor.");
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure("INVALID_TOOL_ARGUMENTS", "Los argumentos de la herramienta no son válidos.");
    }
    logger.warn("ai.server_tool_failed", { name, error });
    return failure(
      "TOOL_FAILED",
      "La herramienta falló al ejecutarse. Informa al usuario sin inventar un resultado.",
    );
  }
}
