import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { ChargersError, chargersConfigured, findChargingStations } from "@/lib/integrations/open-charge-map";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(2).max(150).default(25),
  max: z.coerce.number().int().min(5).max(60).default(40),
});

/** Estaciones de carga cercanas (Open Charge Map), ordenadas por distancia. */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`chargers:${ip}`, 30, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas consultas de estaciones.", 429, true, rateLimitHeaders(limit));
  if (!chargersConfigured()) {
    return jsonError("CHARGERS_NOT_CONFIGURED", "Las estaciones de carga no están configuradas: falta OPENCHARGEMAP_API_KEY en el servidor.", 503);
  }
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lon: url.searchParams.get("lon"),
    radius: url.searchParams.get("radius") ?? undefined,
    max: url.searchParams.get("max") ?? undefined,
  });
  if (!parsed.success) return jsonError("INVALID_QUERY", "Coordenadas o radio inválidos.", 400);
  try {
    const stations = await findChargingStations({ latitude: parsed.data.lat, longitude: parsed.data.lon, radiusKm: parsed.data.radius, maxResults: parsed.data.max });
    return jsonOk({ stations, attribution: "Datos de estaciones: Open Charge Map (CC BY 4.0)" });
  } catch (error) {
    if (error instanceof ChargersError) return jsonError(error.code, error.message, error.status, error.status >= 500 || error.status === 429);
    logger.error("chargers.unexpected", { error });
    return jsonError("CHARGERS_UNEXPECTED", "No pudimos consultar las estaciones.", 502, true);
  }
}
