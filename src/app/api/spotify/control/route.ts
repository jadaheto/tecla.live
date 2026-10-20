import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import {
  controlSpotify,
  SpotifyError,
  spotifyConfigured,
} from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    action: z.enum(["play", "pause", "next", "previous", "volume"]),
    volume: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para controlar Spotify.", 401, false);
  }
  if (!spotifyConfigured()) {
    return jsonError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503, false);
  }

  const limit = consumeRateLimit(`spotify-control:${claims.userId}`, 30, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas acciones de Spotify. Espera un momento.", 429, true);
  }

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("INVALID_ACTION", "La acción de Spotify no es válida.", 400);
  }

  try {
    const result = await controlSpotify(
      claims.userId,
      parsed.data.action,
      parsed.data.volume,
    );
    return jsonOk(result);
  } catch (error) {
    if (error instanceof SpotifyError) {
      return jsonError(error.code, error.message, error.status, error.status >= 500);
    }
    logger.warn("spotify.control_failed", { error });
    return jsonError("SPOTIFY_CONTROL_FAILED", "Spotify no pudo ejecutar la acción.", 503, true);
  }
}
