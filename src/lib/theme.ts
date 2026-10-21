import type { ResolvedTheme, ThemeMode } from "@/types";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function formatBogotaTime(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(date);
}

export function formatBogotaDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function isWithinWindow(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function resolveTheme(input: {
  mode: ThemeMode;
  now: Date;
  autoEnabled: boolean;
  start: string;
  end: string;
}): ResolvedTheme {
  const { mode, now, autoEnabled, start, end } = input;
  if (mode === "light" || mode === "dark") return mode;
  if (!autoEnabled) return "dark";
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return "dark";
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return isWithinWindow(nowMinutes, startMinutes, endMinutes) ? "dark" : "light";
}

export function getBogotaMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('tecla-preferences-v1');
    var parsed = raw ? JSON.parse(raw) : null;
    var state = (parsed && parsed.state) || {};
    var style = state.visualStyle === 'cyberpunk' || state.visualStyle === 'kitt' ? state.visualStyle : 'tecla';
    document.documentElement.dataset.style = style;
    var mode = state.theme || 'auto';
    var forcedDark = style === 'cyberpunk' || style === 'kitt';
    var dark = mode === 'dark' || forcedDark;
    if (mode === 'auto' && !forcedDark) {
      var autoEnabled = state.autoThemeEnabled !== false;
      if (!autoEnabled) {
        dark = true;
      } else {
        var start = (state.autoThemeStart || '18:30').split(':');
        var end = (state.autoThemeEnd || '06:30').split(':');
        var startM = Number(start[0]) * 60 + Number(start[1]);
        var endM = Number(end[0]) * 60 + Number(end[1]);
        var now = new Date();
        var nowM = now.getHours() * 60 + now.getMinutes();
        var inWindow = startM < endM ? (nowM >= startM && nowM < endM) : (nowM >= startM || nowM < endM);
        dark = startM === endM ? false : inWindow;
      }
    }
    if (dark) document.documentElement.classList.add('dark');
    var displayMode = state.displayMode || 'normal';
    document.documentElement.dataset.displayMode = displayMode;
    if (state.reduceMotion) document.documentElement.classList.add('reduce-motion');
  } catch (error) {}
})();
`;
