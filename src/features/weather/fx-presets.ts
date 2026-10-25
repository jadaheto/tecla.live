import { describeWeather } from "@/lib/weather-codes";

/**
 * Traduce el clima real (código WMO de Open-Meteo, día/noche y viento) al
 * efecto que se dibuja sobre la pantalla principal. Lógica pura y probada:
 * el canvas solo pinta lo que este preset indica.
 */
export type WeatherFxKind = "rain" | "storm" | "snow" | "fog" | "clouds" | "sun" | "stars" | "none";

export interface WeatherFxPreset {
  kind: WeatherFxKind;
  /** Partículas por millón de píxeles (gotas, copos, motas). */
  density: number;
  /** Inclinación de la caída en grados, positiva hacia la derecha (por el viento). */
  angle: number;
  /** Velocidad base de caída (px por segundo a 1080p). */
  speed: number;
  /** Relámpagos ocasionales (solo tormenta). */
  flashes: boolean;
  /** Opacidad general del efecto. */
  opacity: number;
}

const HEAVY_CODES = new Set([55, 57, 65, 67, 75, 82, 86, 96, 99]);
const LIGHT_CODES = new Set([51, 56, 61, 66, 71, 77, 80, 85]);

export function weatherFxPreset(input: { code: number; isDay: boolean; windSpeed?: number }): WeatherFxPreset {
  const { group } = describeWeather(input.code);
  const wind = Math.max(0, Math.min(60, input.windSpeed ?? 0));
  const angle = Math.round(Math.min(28, wind * 0.45));
  const heavy = HEAVY_CODES.has(input.code);
  const light = LIGHT_CODES.has(input.code);

  switch (group) {
    case "drizzle":
      return { kind: "rain", density: heavy ? 120 : 70, angle, speed: 560, flashes: false, opacity: 0.6 };
    case "rain":
      return { kind: "rain", density: heavy ? 300 : light ? 150 : 220, angle, speed: heavy ? 1100 : 900, flashes: false, opacity: 0.78 };
    case "storm":
      return { kind: "storm", density: 340, angle: Math.max(angle, 10), speed: 1250, flashes: true, opacity: 0.85 };
    case "snow":
      return { kind: "snow", density: heavy ? 140 : light ? 60 : 95, angle: Math.min(angle, 15), speed: 90, flashes: false, opacity: 0.8 };
    case "fog":
      return { kind: "fog", density: 6, angle: 0, speed: 12, flashes: false, opacity: 0.55 };
    case "clouds":
      return { kind: "clouds", density: input.code === 3 ? 7 : 4, angle: 0, speed: 10, flashes: false, opacity: 0.35 };
    case "clear":
      return input.isDay
        ? { kind: "sun", density: 18, angle: 0, speed: 25, flashes: false, opacity: 0.35 }
        : { kind: "stars", density: 70, angle: 0, speed: 0, flashes: false, opacity: 0.7 };
    default:
      return { kind: "none", density: 0, angle: 0, speed: 0, flashes: false, opacity: 0 };
  }
}

/** Cantidad de partículas para un área dada, con tope para proteger el rendimiento. */
export function particleCount(preset: WeatherFxPreset, width: number, height: number, scale = 1): number {
  const megapixels = (width * height) / 1_000_000;
  return Math.min(900, Math.round(preset.density * megapixels * scale));
}
