import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { fetchPodcastEpisodes, PodcastError } from "@/lib/integrations/podcasts";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`podcasts:${ip}`, 30, 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas búsquedas de podcasts. Espera un momento.",
      429,
      true,
      rateLimitHeaders(limit),
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "La búsqueda de podcasts no es válida.", 400);
  }

  try {
    const episodes = await fetchPodcastEpisodes({ query: parsed.data.q, limit: parsed.data.limit });
    return jsonOk({ episodes, query: parsed.data.q });
  } catch (error) {
    if (error instanceof PodcastError) {
      logger.warn("podcasts.fetch_failed", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, true);
    }
    logger.error("podcasts.unexpected", { error });
    return jsonError("PODCASTS_ERROR", "No pudimos buscar podcasts.", 502, true);
  }
}
