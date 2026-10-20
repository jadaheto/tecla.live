import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { serverConfig } from "@/lib/env";
import { createYouTubeClient, YouTubeError } from "@/lib/integrations/youtube";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().trim().min(2, "La búsqueda debe tener al menos 2 caracteres").max(120),
  limit: z.coerce.number().int().min(1).max(20).default(12),
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
  const limit = consumeRateLimit(`youtube-search:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas búsquedas seguidas. Espera un momento.",
      429,
      true,
      rateLimitHeaders(limit),
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(
      "INVALID_QUERY",
      parsed.error.issues[0]?.message ?? "La búsqueda no es válida.",
      400,
    );
  }

  try {
    const client = createYouTubeClient({ apiKey: serverConfig.youtubeApiKey });
    const videos = await client.search({
      query: parsed.data.q,
      limit: parsed.data.limit,
      region: parsed.data.region,
    });
    return jsonOk({ videos, query: parsed.data.q, configured: true });
  } catch (error) {
    if (error instanceof YouTubeError) {
      logger.warn("youtube.search_failed", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, error.retryable);
    }
    logger.error("youtube.search_unexpected", { error });
    return jsonError("YOUTUBE_ERROR", "No pudimos buscar en YouTube.", 502, true);
  }
}
