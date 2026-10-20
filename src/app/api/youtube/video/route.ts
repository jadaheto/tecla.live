import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { serverConfig } from "@/lib/env";
import { createYouTubeClient, YouTubeError } from "@/lib/integrations/youtube";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  id: z.string().trim().regex(/^[A-Za-z0-9_-]{6,20}$/),
});

export async function GET(request: Request) {
  if (!serverConfig.youtubeApiKey) {
    return jsonError(
      "YOUTUBE_NOT_CONFIGURED",
      "YouTube todavía no está configurado. Añade YOUTUBE_API_KEY en el servidor.",
      503,
      false,
    );
  }

  const ip = getClientIp(request);
  const limit = consumeRateLimit(`youtube-video:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas solicitudes. Espera un momento.",
      429,
      true,
      rateLimitHeaders(limit),
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ id: url.searchParams.get("id") ?? "" });
  if (!parsed.success) {
    return jsonError("INVALID_VIDEO_ID", "El identificador del video no es válido.", 400);
  }

  try {
    const client = createYouTubeClient({ apiKey: serverConfig.youtubeApiKey });
    const video = await client.video(parsed.data.id);
    if (!video) {
      return jsonError("VIDEO_NOT_FOUND", "Ese video no está disponible.", 404, false);
    }
    return jsonOk({ video });
  } catch (error) {
    if (error instanceof YouTubeError) {
      logger.warn("youtube.video_failed", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, error.retryable);
    }
    logger.error("youtube.video_unexpected", { error });
    return jsonError("YOUTUBE_ERROR", "No pudimos cargar el video.", 502, true);
  }
}
