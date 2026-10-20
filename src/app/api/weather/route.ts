import { z } from "zod";
import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { fetchWeather } from "@/lib/integrations/weather";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { publicConfig } from "@/lib/public-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  location: z.string().trim().min(2).max(80).optional(),
});

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`weather:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas consultas de clima. Espera un momento.",
      429,
      true,
      rateLimitHeaders(limit),
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    lat: url.searchParams.get("lat") ?? undefined,
    lon: url.searchParams.get("lon") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "Coordenadas o ubicación inválidas.", 400);
  }

  try {
    const snapshot = await fetchWeather({
      lat: parsed.data.lat ?? publicConfig.weatherLat,
      lon: parsed.data.lon ?? publicConfig.weatherLon,
      location: parsed.data.location ?? publicConfig.weatherLocation,
    });
    return jsonOk(snapshot, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    logger.warn("weather.fetch_failed", { error });
    return jsonError(
      "WEATHER_UNAVAILABLE",
      "El clima no está disponible ahora. Puedes seguir usando TECLA LIVE.",
      503,
      true,
    );
  }
}

export async function POST(request: Request) {
  // Se acepta POST para mantener compatibilidad con clientes que no quieren
  // cachear la consulta; no se acepta cuerpo.
  void (await readJson(request));
  return jsonError("METHOD_NOT_SUPPORTED", "Usa GET para consultar el clima.", 405);
}
