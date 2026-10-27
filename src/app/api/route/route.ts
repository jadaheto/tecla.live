import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { drivingRoute } from "@/lib/integrations/routing";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLon: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLon: z.coerce.number().min(-180).max(180),
});

/** Ruta en auto entre dos puntos para dibujarla en el mapa de TECLA (OSRM, © OpenStreetMap). */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`route:${ip}`, 20, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas rutas seguidas.", 429, true, rateLimitHeaders(limit));
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return jsonError("INVALID_QUERY", "Coordenadas inválidas.", 400);
  const route = await drivingRoute(
    { latitude: parsed.data.fromLat, longitude: parsed.data.fromLon },
    { latitude: parsed.data.toLat, longitude: parsed.data.toLon },
  );
  return jsonOk({ route, attribution: "Rutas: OSRM · © OpenStreetMap" });
}
