import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { disconnectSpotify, spotifyEncryptionConfigured } from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { isDatabaseConfigured } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para desconectar Spotify.", 401, false);
  }
  if (!spotifyEncryptionConfigured() || !isDatabaseConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }
  try {
    await disconnectSpotify(claims.userId);
    return jsonOk({ connected: false });
  } catch (error) {
    logger.warn("spotify.disconnect_failed", { error });
    return jsonError("SPOTIFY_DISCONNECT_FAILED", "No pudimos desconectar Spotify.", 503, true);
  }
}
