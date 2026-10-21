import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { searchSpotifyTracks, SpotifyError, spotifyConfigured } from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

export async function GET(request: Request) {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para buscar en Spotify.", 401, false);
  }
  if (!spotifyConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }
  const limit = consumeRateLimit(`spotify-search:${claims.userId}`, 40, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas búsquedas en Spotify. Espera un momento.", 429, true);
  }
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "Escribe al menos dos caracteres para buscar.", 400);
  }
  try {
    const tracks = await searchSpotifyTracks(claims.userId, parsed.data.q, parsed.data.limit);
    return jsonOk({ query: parsed.data.q, tracks });
  } catch (error) {
    if (error instanceof SpotifyError) {
      return jsonError(error.code, error.message, error.status, error.status >= 500);
    }
    logger.warn("spotify.search_failed", { error });
    return jsonError("SPOTIFY_SEARCH_FAILED", "Spotify no pudo completar la búsqueda.", 503, true);
  }
}
