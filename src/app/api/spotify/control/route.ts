import { z } from "zod";
import { jsonError, jsonOk, readJson } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import {
  controlSpotify,
  playSpotifyUri,
  SpotifyError,
  spotifyConfigured,
  transferSpotifyPlayback,
} from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    action: z.enum(["play", "pause", "next", "previous", "volume", "transfer"]),
    volume: z.number().int().min(0).max(100).optional(),
    uri: z
      .string()
      .regex(/^spotify:(track|album|playlist|artist):[A-Za-z0-9]{10,40}$/)
      .optional(),
    deviceId: z.string().min(1).max(80).optional(),
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
    if (parsed.data.action === "transfer") {
      if (!parsed.data.deviceId) {
        return jsonError("SPOTIFY_DEVICE_REQUIRED", "Falta el dispositivo de destino.", 400);
      }
      await transferSpotifyPlayback(claims.userId, parsed.data.deviceId, true);
      return jsonOk({ action: "transfer", deviceId: parsed.data.deviceId });
    }
    if (parsed.data.action === "play" && parsed.data.uri) {
      const result = await playSpotifyUri(claims.userId, parsed.data.uri, parsed.data.deviceId ?? null);
      return jsonOk({ action: "play", ...result });
    }
    const result = await controlSpotify(
      claims.userId,
      parsed.data.action,
      parsed.data.volume,
      parsed.data.deviceId ?? null,
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
