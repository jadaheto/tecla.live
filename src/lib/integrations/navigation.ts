export const WAZE_LIVE_MAP_URL = "https://www.waze.com/live-map/";

export function buildWazeSearchUrl(destination: string): string {
  const query = destination.trim();
  if (query.length < 2) throw new Error("DESTINATION_TOO_SHORT");
  return `https://www.waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

export function buildWazeRouteUrl(input: {
  latitude: number;
  longitude: number;
}): string {
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    Math.abs(input.latitude) > 90 ||
    Math.abs(input.longitude) > 180
  ) {
    throw new Error("INVALID_COORDINATES");
  }
  return `https://www.waze.com/ul?ll=${input.latitude}%2C${input.longitude}&navigate=yes`;
}

export function buildGoogleMapsSearchUrl(destination: string): string {
  const query = destination.trim();
  if (query.length < 2) throw new Error("DESTINATION_TOO_SHORT");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildGoogleMapsRouteUrl(destination: string): string {
  const query = destination.trim();
  if (query.length < 2) throw new Error("DESTINATION_TOO_SHORT");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function buildNavigateHref(
  provider: "waze" | "maps",
  destination: string,
): string {
  return `/navigate?tab=${provider}&q=${encodeURIComponent(destination.trim())}`;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

function validCoordinates(input: GeoCoordinates): boolean {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) && Math.abs(input.latitude) <= 90 && Math.abs(input.longitude) <= 180;
}

/** Ruta en Google Maps por coordenadas; sin `origin` la app usa la ubicación actual. */
export function buildGoogleMapsDirectionsUrl(destination: GeoCoordinates, origin?: GeoCoordinates | null): string {
  if (!validCoordinates(destination)) throw new Error("INVALID_COORDINATES");
  const params = new URLSearchParams({ api: "1", destination: `${destination.latitude},${destination.longitude}`, travelmode: "driving" });
  if (origin && validCoordinates(origin)) params.set("origin", `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Enlace interno a Navegar con un lugar por coordenadas (estación de carga,
 * destino guardado…). Navegar prepara la ruta y abre Waze o Google Maps con
 * la ubicación actual como origen (o `from`, por ejemplo la posición del Tesla).
 */
export function buildNavigateToPlaceHref(
  provider: "waze" | "maps",
  place: GeoCoordinates & { label: string },
  from?: GeoCoordinates | null,
): string {
  if (!validCoordinates(place)) throw new Error("INVALID_COORDINATES");
  const params = new URLSearchParams({
    tab: provider,
    lat: place.latitude.toFixed(5),
    lon: place.longitude.toFixed(5),
    label: place.label.trim().slice(0, 120),
  });
  if (from && validCoordinates(from)) params.set("from", `${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}`);
  return `/navigate?${params.toString()}`;
}

/** Lee `lat`, `lon`, `label` y `from` de la URL de Navegar; null si no hay lugar válido. */
export function parsePlaceParams(params: { get(name: string): string | null }): { place: GeoCoordinates & { label: string }; from: GeoCoordinates | null } | null {
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!validCoordinates({ latitude, longitude }) || params.get("lat") === null || params.get("lon") === null) return null;
  const label = (params.get("label") ?? "").trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  const fromRaw = params.get("from");
  let from: GeoCoordinates | null = null;
  if (fromRaw) {
    const [fromLat, fromLon] = fromRaw.split(",").map(Number);
    if (fromLat !== undefined && fromLon !== undefined && validCoordinates({ latitude: fromLat, longitude: fromLon })) from = { latitude: fromLat, longitude: fromLon };
  }
  return { place: { latitude, longitude, label }, from };
}
