import { jsonError, jsonOk, NO_STORE } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  getSpotifyAccessToken,
  scopeAllowsStreaming,
  SpotifyError,
  spotifyConfigured,
} from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrega un token de acceso de corta duración al reproductor web de Spotify
 * (Web Playback SDK) del propio usuario. Solo con sesión activa, cuenta
 * vinculada y permiso `streaming`. Nunca se cachea ni se registra.
 */
export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para usar el reproductor de Spotify.", 401, false);
  }
  if (!spotifyConfigured() || !isDatabaseConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }
  const limit = consumeRateLimit(`spotify-token:${claims.userId}`, 20, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas solicitudes de token.", 429, true);
  }
  try {
    const account = await prisma.connectedAccount.findUnique({
      where: { userId_provider: { userId: claims.userId, provider: "spotify" } },
      select: { scope: true },
    });
    if (!account) {
      return jsonError("SPOTIFY_NOT_CONNECTED", "Vincula tu cuenta de Spotify en Música.", 401, false);
    }
    if (!scopeAllowsStreaming(account.scope)) {
      return jsonError(
        "SPOTIFY_STREAMING_SCOPE_REQUIRED",
        "Vuelve a vincular Spotify para autorizar la reproducción dentro de TECLA LIVE.",
        403,
        false,
      );
    }
    const accessToken = await getSpotifyAccessToken(claims.userId);
    return jsonOk({ accessToken }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof SpotifyError) {
      return jsonError(error.code, error.message, error.status, error.status >= 500);
    }
    logger.warn("spotify.token_failed", { error });
    return jsonError("SPOTIFY_TOKEN_UNAVAILABLE", "No pudimos obtener el token de Spotify.", 503, true);
  }
}
