/**
 * Mapa de estaciones de carga de PlugShare, con el widget oficial para
 * sitios web (developer.plugshare.com/embed). PlugShare no ofrece API para
 * uso personal; el widget es la vía legítima. Lógica pura y probada.
 */
export const PLUGSHARE_WIDGET_URL = "https://www.plugshare.com/widget2.html";
export const PLUGSHARE_SITE_URL = "https://www.plugshare.com/es";

export interface PlugShareCenter {
  latitude: number;
  longitude: number;
}

/** Grados de latitud que cubre un radio en km (≈111 km por grado). */
export function spanForRadiusKm(radiusKm: number, latitude: number): { spanLat: number; spanLng: number } {
  const km = Math.max(2, Math.min(300, radiusKm));
  const spanLat = (km * 2) / 111;
  const cos = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const spanLng = (km * 2) / (111 * cos);
  return { spanLat: Number(spanLat.toFixed(4)), spanLng: Number(spanLng.toFixed(4)) };
}

export function plugShareWidgetUrl(center: PlugShareCenter | null, radiusKm = 25): string {
  const params = new URLSearchParams();
  if (center) {
    params.set("latitude", center.latitude.toFixed(5));
    params.set("longitude", center.longitude.toFixed(5));
    const span = spanForRadiusKm(radiusKm, center.latitude);
    params.set("spanLat", String(span.spanLat));
    params.set("spanLng", String(span.spanLng));
  }
  const query = params.toString();
  return query ? `${PLUGSHARE_WIDGET_URL}?${query}` : PLUGSHARE_WIDGET_URL;
}
