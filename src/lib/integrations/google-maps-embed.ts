/**
 * Google Maps Embed API (modo «directions»): la ruta de Google dibujada
 * dentro de TECLA LIVE sin salir de la app. Google no cobra el Embed API,
 * pero la clave es pública por diseño (va en la URL del iframe) y debe
 * restringirse en Google Cloud a los referentes de tecla.live y a esa API.
 */
export interface EmbedPoint {
  latitude: number;
  longitude: number;
}

export type EmbedPlace = EmbedPoint | string;

function placeParam(place: EmbedPlace): string {
  if (typeof place === "string") return place.trim();
  return `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
}

export function buildGoogleMapsEmbedDirectionsUrl(input: { key: string; origin: EmbedPlace; destination: EmbedPlace; avoid?: Array<"tolls" | "ferries" | "highways"> }): string {
  const params = new URLSearchParams({
    key: input.key,
    origin: placeParam(input.origin),
    destination: placeParam(input.destination),
    mode: "driving",
    language: "es",
    region: "co",
  });
  if (input.avoid?.length) params.set("avoid", input.avoid.join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}

/** Mapa de un lugar (sin origen), para cuando todavía no hay ubicación. */
export function buildGoogleMapsEmbedPlaceUrl(input: { key: string; place: EmbedPlace }): string {
  const params = new URLSearchParams({ key: input.key, q: placeParam(input.place), language: "es", region: "co" });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

/** Distancia aproximada en metros entre dos puntos (para decidir si vale la pena recalcular). */
export function metersBetween(a: EmbedPoint, b: EmbedPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
