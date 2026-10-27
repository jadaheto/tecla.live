import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Ruta en auto entre dos puntos con OSRM (servidor público de demostración
 * del proyecto, datos © OpenStreetMap). Uso ligero: una ruta por estación
 * elegida, con caché de 10 minutos. Si no responde, el mapa dibuja una línea
 * recta y lo dice.
 */
export interface DrivingRoute {
  distanceKm: number;
  durationMin: number;
  /** Pares [latitud, longitud] simplificados. */
  geometry: Array<[number, number]>;
  source: "osrm";
}

const RouteSchema = z.looseObject({
  code: z.string(),
  routes: z
    .array(
      z.looseObject({
        distance: z.number(),
        duration: z.number(),
        geometry: z.looseObject({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
      }),
    )
    .optional(),
});

const cache = new Map<string, { route: DrivingRoute | null; at: number }>();
const CACHE_TTL_MS = 10 * 60_000;

/** Reduce la geometría a un máximo de puntos para no inflar la respuesta. */
export function thinGeometry(points: Array<[number, number]>, maxPoints = 400): Array<[number, number]> {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: Array<[number, number]> = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const point = points[Math.floor(i * step)];
    if (point) result.push(point);
  }
  const last = points[points.length - 1];
  if (last) result.push(last);
  return result;
}

export async function drivingRoute(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): Promise<DrivingRoute | null> {
  const key = `${from.latitude.toFixed(4)},${from.longitude.toFixed(4)}>${to.latitude.toFixed(4)},${to.longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.route;
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, {
      headers: { "User-Agent": "TECLA LIVE (tecla.live)", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      logger.warn("routing.failed", { status: response.status });
      cache.set(key, { route: null, at: Date.now() });
      return null;
    }
    const parsed = RouteSchema.safeParse(await response.json().catch(() => null));
    const best = parsed.success && parsed.data.code === "Ok" ? parsed.data.routes?.[0] : undefined;
    if (!best) {
      cache.set(key, { route: null, at: Date.now() });
      return null;
    }
    const route: DrivingRoute = {
      distanceKm: Math.round(best.distance / 100) / 10,
      durationMin: Math.max(1, Math.round(best.duration / 60)),
      geometry: thinGeometry(best.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
      source: "osrm",
    };
    cache.set(key, { route, at: Date.now() });
    return route;
  } catch {
    logger.warn("routing.unreachable");
    return null;
  }
}
