export interface WeatherCondition {
  group: "clear" | "clouds" | "fog" | "drizzle" | "rain" | "snow" | "storm" | "unknown";
  label: string;
}

const CONDITIONS: Record<number, WeatherCondition> = {
  0: { group: "clear", label: "Despejado" },
  1: { group: "clear", label: "Mayormente despejado" },
  2: { group: "clouds", label: "Parcialmente nublado" },
  3: { group: "clouds", label: "Nublado" },
  45: { group: "fog", label: "Niebla" },
  48: { group: "fog", label: "Niebla con escarcha" },
  51: { group: "drizzle", label: "Llovizna ligera" },
  53: { group: "drizzle", label: "Llovizna" },
  55: { group: "drizzle", label: "Llovizna intensa" },
  56: { group: "drizzle", label: "Llovizna helada" },
  57: { group: "drizzle", label: "Llovizna helada intensa" },
  61: { group: "rain", label: "Lluvia ligera" },
  63: { group: "rain", label: "Lluvia" },
  65: { group: "rain", label: "Lluvia intensa" },
  66: { group: "rain", label: "Lluvia helada" },
  67: { group: "rain", label: "Lluvia helada intensa" },
  71: { group: "snow", label: "Nieve ligera" },
  73: { group: "snow", label: "Nieve" },
  75: { group: "snow", label: "Nieve intensa" },
  77: { group: "snow", label: "Granos de nieve" },
  80: { group: "rain", label: "Chubascos ligeros" },
  81: { group: "rain", label: "Chubascos" },
  82: { group: "rain", label: "Chubascos fuertes" },
  85: { group: "snow", label: "Chubascos de nieve" },
  86: { group: "snow", label: "Chubascos de nieve fuertes" },
  95: { group: "storm", label: "Tormenta" },
  96: { group: "storm", label: "Tormenta con granizo" },
  99: { group: "storm", label: "Tormenta con granizo fuerte" },
};

export function describeWeather(code: number): WeatherCondition {
  return CONDITIONS[code] ?? { group: "unknown", label: "Condición variable" };
}
