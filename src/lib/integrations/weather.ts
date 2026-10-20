import { z } from "zod";
import { describeWeather } from "@/lib/weather-codes";
import type { WeatherSnapshot } from "@/types";

const OpenMeteoResponse = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    apparent_temperature: z.number(),
    is_day: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
});

interface CacheEntry {
  snapshot: WeatherSnapshot;
  storedAt: number;
}

const CACHE_TTL_MS = 10 * 60_000;
const globalCache = globalThis as unknown as { __teclaWeather?: Map<string, CacheEntry> };

function cache(): Map<string, CacheEntry> {
  if (!globalCache.__teclaWeather) globalCache.__teclaWeather = new Map();
  return globalCache.__teclaWeather;
}

export async function fetchWeather(input: {
  lat: number;
  lon: number;
  location: string;
}): Promise<WeatherSnapshot> {
  const key = `${input.lat.toFixed(3)},${input.lon.toFixed(3)}`;
  const cached = cache().get(key);
  if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
    return { ...cached.snapshot, location: input.location };
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.lat));
  url.searchParams.set("longitude", String(input.lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "America/Bogota");

  const response = await fetch(url, {
    headers: { "User-Agent": "TECLA-LIVE/0.1 (+https://tecla.live)" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WEATHER_UPSTREAM_${response.status}`);
  }

  const parsed = OpenMeteoResponse.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("WEATHER_INVALID_RESPONSE");
  }

  const current = parsed.data.current;
  const condition = describeWeather(current.weather_code);
  const snapshot: WeatherSnapshot = {
    location: input.location,
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature),
    humidity: Math.round(current.relative_humidity_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    precipitation: current.precipitation,
    isDay: current.is_day === 1,
    code: current.weather_code,
    label: condition.label,
    updatedAt: new Date().toISOString(),
  };

  cache().set(key, { snapshot, storedAt: Date.now() });
  return snapshot;
}

const GeoResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

export async function geocodeLocation(
  query: string,
): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: { "User-Agent": "TECLA-LIVE/0.1 (+https://tecla.live)" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GEOCODING_UPSTREAM_${response.status}`);
  const parsed = GeoResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("GEOCODING_INVALID_RESPONSE");
  const first = parsed.data.results?.[0];
  if (!first) return null;
  return {
    lat: first.latitude,
    lon: first.longitude,
    label: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
  };
}

export async function fetchWeatherForLocation(location: string): Promise<WeatherSnapshot> {
  const place = await geocodeLocation(location);
  if (!place) throw new Error("LOCATION_NOT_FOUND");
  return fetchWeather({ lat: place.lat, lon: place.lon, location: place.label });
}
