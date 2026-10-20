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
