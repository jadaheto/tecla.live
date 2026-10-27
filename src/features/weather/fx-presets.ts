import { describeWeather } from "@/lib/weather-codes";
import type { VisualStyle } from "@/types";

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

/** Colores del efecto según el estilo visual activo (y el tema en el estilo TECLA). */
export interface WeatherFxPalette {
  /** Trazo de la lluvia. */
  rain: string;
  /** Velo que oscurece la pantalla en tormenta. */
  veil: string;
  /** Color del relámpago. */
  flash: string;
  /** Copos de nieve. */
  snow: string;
  /** Tono RGB («r, g, b») de la niebla y las nubes. */
  fogTone: string;
  /** Resplandor del sol (RGB «r, g, b»). */
  sunTone: string;
  /** Motas de luz con sol. */
  mote: string;
  /** Estrellas. */
  star: string;
}

export function weatherFxPalette(style: VisualStyle, dark: boolean, isDay: boolean): WeatherFxPalette {
  switch (style) {
    case "cyberpunk":
      // Lluvia ácida de Night City: amarillo neón con relámpagos cian.
      return {
        rain: "rgba(252, 238, 10, 0.82)",
        veil: "rgba(8, 6, 20, 0.3)",
        flash: "#00f0ff",
        snow: "rgba(252, 238, 10, 0.9)",
        fogTone: "0, 240, 255",
        sunTone: "252, 238, 10",
        mote: "rgba(0, 240, 255, 0.85)",
        star: "rgba(252, 238, 10, 0.95)",
      };
    case "kitt":
      // Rojo escáner con ámbar del tablero.
      return {
        rain: "rgba(255, 46, 46, 0.8)",
        veil: "rgba(20, 0, 0, 0.3)",
        flash: "#ffb000",
        snow: "rgba(255, 176, 0, 0.9)",
        fogTone: "255, 40, 40",
        sunTone: "255, 176, 0",
        mote: "rgba(255, 176, 0, 0.85)",
        star: "rgba(255, 60, 60, 0.95)",
      };
    case "roadster":
      // Rojo monocromo de cabina.
      return {
        rain: "rgba(255, 43, 43, 0.75)",
        veil: "rgba(10, 0, 0, 0.28)",
        flash: "#ff6b6b",
        snow: "rgba(255, 43, 43, 0.85)",
        fogTone: "255, 43, 43",
        sunTone: "255, 43, 43",
        mote: "rgba(255, 90, 90, 0.85)",
        star: "rgba(255, 43, 43, 0.95)",
      };
    case "discovery":
      // Hologramas azul cian del puente; relámpagos blancos azulados.
      return {
        rain: "rgba(95, 211, 255, 0.78)",
        veil: "rgba(2, 10, 24, 0.3)",
        flash: "#dff6ff",
        snow: "rgba(190, 236, 255, 0.9)",
        fogTone: "95, 211, 255",
        sunTone: "142, 197, 255",
        mote: "rgba(190, 236, 255, 0.85)",
        star: "rgba(142, 197, 255, 0.95)",
      };
    default:
      return {
        rain: dark ? "rgba(215, 228, 255, 0.75)" : "rgba(58, 78, 118, 0.62)",
        veil: dark ? "rgba(10, 14, 28, 0.22)" : "rgba(40, 50, 80, 0.14)",
        flash: "#f4f6ff",
        snow: dark ? "rgba(255, 255, 255, 0.9)" : "rgba(110, 140, 185, 0.85)",
        fogTone: isDay ? "255, 255, 255" : "190, 200, 220",
        sunTone: "255, 214, 140",
        mote: "rgba(255, 236, 200, 0.8)",
        star: "rgba(255, 255, 255, 0.9)",
      };
  }
}
