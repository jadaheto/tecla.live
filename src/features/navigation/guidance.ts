/**
 * Guía de navegación (lógica pura, probada): decodifica polilíneas de
 * Google, sitúa al auto sobre la ruta, calcula lo que falta, decide cuándo
 * anunciar una maniobra y cuándo hay desvío. El componente de mapa solo
 * dibuja lo que esto devuelve.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface GuidanceStep {
  /** Texto de Google («Gira a la derecha en Calle 80»). */
  instruction: string;
  /** Maniobra de Google (TURN_LEFT, ROUNDABOUT_RIGHT, DEPART, …). */
  maneuver: string;
  distanceM: number;
  durationS: number;
  path: LatLng[];
}

export interface GuidanceRoute {
  distanceM: number;
  durationS: number;
  path: LatLng[];
  steps: GuidanceStep[];
}

/** Decodifica el formato de polilínea codificada de Google. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const EARTH_M = 6_371_000;

export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Proyección local en metros (suficiente para distancias de calle). */
function toXY(point: LatLng, origin: LatLng): { x: number; y: number } {
  const kx = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (point.lng - origin.lng) * kx, y: (point.lat - origin.lat) * 110_540 };
}

/** Distancia (m) de un punto al segmento a–b y fracción recorrida sobre él. */
export function distanceToSegment(point: LatLng, a: LatLng, b: LatLng): { distance: number; t: number } {
  const p = toXY(point, a);
  const q = toXY(b, a);
  const len2 = q.x * q.x + q.y * q.y;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (p.x * q.x + p.y * q.y) / len2));
  const dx = p.x - q.x * t;
  const dy = p.y - q.y * t;
  return { distance: Math.sqrt(dx * dx + dy * dy), t };
}

export interface RoutePosition {
  stepIndex: number;
  /** Distancia del auto a la ruta (m). */
  offRouteM: number;
  /** Lo que falta para terminar el paso actual (la próxima maniobra). */
  toManeuverM: number;
  remainingM: number;
  remainingS: number;
}

/**
 * Sitúa el auto en la ruta: busca el segmento más cercano (prefiriendo el
 * paso actual y los siguientes para no «retroceder» en calles cercanas).
 */
export function locateOnRoute(position: LatLng, route: GuidanceRoute, fromStep = 0): RoutePosition {
  let best: { step: number; seg: number; distance: number; t: number } | null = null;
  for (let s = Math.max(0, fromStep); s < route.steps.length; s += 1) {
    const path = route.steps[s]?.path ?? [];
    for (let i = 0; i + 1 < path.length; i += 1) {
      const result = distanceToSegment(position, path[i]!, path[i + 1]!);
      // Ligera preferencia por lo que viene (evita saltar a pasos anteriores cercanos).
      const score = result.distance + (s - fromStep) * 2;
      if (!best || score < best.distance + (best.step - fromStep) * 2) best = { step: s, seg: i, distance: result.distance, t: result.t };
    }
  }
  if (!best) return { stepIndex: fromStep, offRouteM: Number.POSITIVE_INFINITY, toManeuverM: 0, remainingM: route.distanceM, remainingS: route.durationS };
  const step = route.steps[best.step]!;
  let toManeuver = 0;
  for (let i = best.seg; i + 1 < step.path.length; i += 1) {
    const segmentLength = distanceM(step.path[i]!, step.path[i + 1]!);
    toManeuver += i === best.seg ? segmentLength * (1 - best.t) : segmentLength;
  }
  let remainingM = toManeuver;
  let remainingS = step.durationS * (step.distanceM > 0 ? toManeuver / step.distanceM : 0);
  for (let s = best.step + 1; s < route.steps.length; s += 1) {
    remainingM += route.steps[s]!.distanceM;
    remainingS += route.steps[s]!.durationS;
  }
  return { stepIndex: best.step, offRouteM: best.distance, toManeuverM: Math.round(toManeuver), remainingM: Math.round(remainingM), remainingS: Math.round(remainingS) };
}

export const OFF_ROUTE_M = 60;
export const OFF_ROUTE_FIXES = 3;

/** Desvío confirmado: varias lecturas seguidas lejos de la ruta. */
export function offRouteCounter(previous: number, offRouteM: number): number {
  return offRouteM > OFF_ROUTE_M ? previous + 1 : 0;
}

export type ManeuverIcon = "left" | "right" | "slight-left" | "slight-right" | "sharp-left" | "sharp-right" | "uturn" | "straight" | "roundabout" | "merge" | "fork" | "ramp" | "ferry" | "depart" | "arrive";

export function maneuverIcon(maneuver: string | null | undefined): ManeuverIcon {
  const m = (maneuver ?? "").toUpperCase();
  if (m.includes("UTURN")) return "uturn";
  if (m.includes("ROUNDABOUT")) return "roundabout";
  if (m.includes("MERGE")) return "merge";
  if (m.includes("FORK")) return "fork";
  if (m.includes("RAMP")) return "ramp";
  if (m.includes("FERRY")) return "ferry";
  if (m === "DEPART") return "depart";
  if (m.includes("ARRIVE")) return "arrive";
  if (m.includes("SLIGHT_LEFT")) return "slight-left";
  if (m.includes("SLIGHT_RIGHT")) return "slight-right";
  if (m.includes("SHARP_LEFT")) return "sharp-left";
  if (m.includes("SHARP_RIGHT")) return "sharp-right";
  if (m.includes("LEFT")) return "left";
  if (m.includes("RIGHT")) return "right";
  return "straight";
}

export function formatMeters(meters: number): string {
  if (meters < 50) return "ahora";
  if (meters < 1_000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1_000;
  return km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`;
}

export function formatEta(remainingS: number, now = new Date()): string {
  const arrival = new Date(now.getTime() + remainingS * 1000);
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(arrival);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Umbrales de aviso por voz: lejos (según la velocidad), cerca y al llegar. */
export const ANNOUNCE_FAR_M = 500;
export const ANNOUNCE_NEAR_M = 120;

export type AnnounceStage = "far" | "near";

/**
 * Qué aviso toca para la maniobra actual, si aún no se dio: «far» una vez al
 * entrar en los 500 m (y solo si el paso es largo), «near» en los últimos 120 m.
 */
export function nextAnnouncement(toManeuverM: number, stepDistanceM: number, given: ReadonlySet<AnnounceStage>): AnnounceStage | null {
  if (toManeuverM <= ANNOUNCE_NEAR_M && !given.has("near")) return "near";
  if (toManeuverM <= ANNOUNCE_FAR_M && stepDistanceM > ANNOUNCE_FAR_M + 150 && !given.has("far")) return "far";
  return null;
}

export function announcementText(stage: AnnounceStage, instruction: string, toManeuverM: number): string {
  const clean = instruction.replace(/\s+/g, " ").trim();
  if (stage === "near") return clean;
  return `En ${formatMeters(Math.round(toManeuverM / 50) * 50)}, ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
}

export function humanizeManeuverFallback(icon: ManeuverIcon): string {
  switch (icon) {
    case "left":
      return "Gira a la izquierda";
    case "right":
      return "Gira a la derecha";
    case "slight-left":
      return "Mantente a la izquierda";
    case "slight-right":
      return "Mantente a la derecha";
    case "sharp-left":
      return "Giro cerrado a la izquierda";
    case "sharp-right":
      return "Giro cerrado a la derecha";
    case "uturn":
      return "Da la vuelta";
    case "roundabout":
      return "Toma la glorieta";
    case "merge":
      return "Incorpórate";
    case "fork":
      return "Toma la bifurcación";
    case "ramp":
      return "Toma la rampa";
    case "ferry":
      return "Toma el ferry";
    case "depart":
      return "Inicia la ruta";
    case "arrive":
      return "Llegaste a tu destino";
    default:
      return "Continúa recto";
  }
}
