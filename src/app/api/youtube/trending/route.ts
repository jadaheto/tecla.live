import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { serverConfig } from "@/lib/env";
import { createYouTubeClient, YouTubeError } from "@/lib/integrations/youtube";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
  region: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("CO"),
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
  const limit = consumeRateLimit(`youtube-trending:${ip}`, 20, 60_000);
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
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "Los parámetros de tendencias no son válidos.", 400);
  }

  try {
    const client = createYouTubeClient({ apiKey: serverConfig.youtubeApiKey });
    const videos = await client.trending({
      region: parsed.data.region,
      limit: parsed.data.limit,
    });
    return jsonOk({ videos, region: parsed.data.region, configured: true });
  } catch (error) {
    if (error instanceof YouTubeError) {
      logger.warn("youtube.trending_failed", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, error.retryable);
    }
    logger.error("youtube.trending_unexpected", { error });
    return jsonError("YOUTUBE_ERROR", "No pudimos cargar las tendencias.", 502, true);
  }
}
