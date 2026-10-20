import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { geocodeLocation } from "@/lib/integrations/weather";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});

interface CacheEntry {
  value: { lat: number; lon: number; label: string };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`geocode:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas búsquedas de ubicación. Espera un momento.", 429, true);
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "Escribe una ciudad o lugar válido.", 400);
  }

  const key = parsed.data.q.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return jsonOk({ place: hit.value, cached: true });
  }

  try {
    const place = await geocodeLocation(parsed.data.q);
    if (!place) {
      return jsonError(
        "LOCATION_NOT_FOUND",
        "No encontramos ese lugar. Prueba con ciudad y país, por ejemplo «Medellín, Colombia».",
        404,
      );
    }
    cache.set(key, { value: place, expiresAt: Date.now() + 10 * 60_000 });
    return jsonOk({ place });
  } catch (error) {
    logger.warn("geocode.failed", { error });
    return jsonError("GEOCODE_UNAVAILABLE", "No pudimos buscar el lugar. Intenta de nuevo.", 503, true);
  }
}
