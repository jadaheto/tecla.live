/**
 * Reglas puras de la Pantalla ambiente: cuándo puede activarse sola y cómo
 * se desplaza el contenido para no marcar la pantalla del auto.
 */
export interface AmbientAutoInput {
  idleMinutes: number;
  idleMs: number;
  pathname: string;
  /** Un video (YouTube, IPTV) o Drive están en pantalla: nunca se tapan. */
  videoOnScreen: boolean;
  assistantOpen: boolean;
  overlayOpen: boolean;
  /** Estado real del Tesla: `false` en marcha (nunca se activa sola), `null` si no se sabe. */
  parked?: boolean | null;
}

/** Rutas donde la pantalla ambiente nunca se activa sola. */
const BLOCKED_PREFIXES = ["/drive", "/watch", "/remote", "/iptv", "/twitch"];

export function shouldAutoAmbient(input: AmbientAutoInput): boolean {
  if (input.idleMinutes <= 0) return false;
  if (input.idleMs < input.idleMinutes * 60_000) return false;
  if (BLOCKED_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) return false;
  if (input.videoOnScreen || input.assistantOpen || input.overlayOpen) return false;
  if (input.parked === false) return false;
  return true;
}

/** Desplazamiento (px) del bloque central: cambia cada minuto para evitar el quemado de pantalla. */
export function ambientDrift(minute: number, maxPx = 28): { x: number; y: number } {
  const angle = (minute % 12) * (Math.PI / 6);
  return { x: Math.round(Math.cos(angle) * maxPx), y: Math.round(Math.sin(angle * 1.5) * maxPx * 0.6) };
}

export function formatAmbientTime(date: Date, timeZone = "America/Bogota"): { time: string; seconds: string; date: string } {
  const parts = new Intl.DateTimeFormat("es-CO", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    time: `${get("hour")}:${get("minute")}`,
    seconds: get("second"),
    date: new Intl.DateTimeFormat("es-CO", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date),
  };
}
