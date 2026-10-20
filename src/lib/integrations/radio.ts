import { z } from "zod";
import type { RadioStation } from "@/types";

const RawStationSchema = z.object({
  stationuuid: z.string(),
  name: z.string(),
  url: z.string().optional().default(""),
  url_resolved: z.string().optional().default(""),
  homepage: z.string().optional().default(""),
  favicon: z.string().optional().default(""),
  country: z.string().optional().default(""),
  countrycode: z.string().optional().default(""),
  state: z.string().optional().default(""),
  language: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  bitrate: z.number().optional().default(0),
  codec: z.string().optional().default(""),
  hls: z.number().optional().default(0),
});

export class RadioError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "RadioError";
    this.code = code;
    this.status = status;
  }
}

interface CacheEntry {
  value: RadioStation[];
  expiresAt: number;
}

const globalCache = globalThis as unknown as { __teclaRadioCache?: Map<string, CacheEntry> };
const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

function cache(): Map<string, CacheEntry> {
  if (!globalCache.__teclaRadioCache) globalCache.__teclaRadioCache = new Map();
  return globalCache.__teclaRadioCache;
}

function sanitizeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toStation(raw: z.infer<typeof RawStationSchema>): RadioStation | null {
  const resolved = sanitizeUrl(raw.url_resolved || raw.url);
  if (!resolved) return null;
  return {
    id: raw.stationuuid,
    name: raw.name.trim(),
    url: resolved,
    favicon: sanitizeUrl(raw.favicon) ?? undefined,
    country: raw.country || undefined,
    countryCode: raw.countrycode || undefined,
    state: raw.state || undefined,
    language: raw.language || undefined,
    tags: raw.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6),
    bitrate: raw.bitrate || undefined,
    isHls: raw.hls === 1 || /\.m3u8(\?|$)/i.test(resolved),
  };
}

/** Se descartan emisoras HTTP para evitar contenido mixto cuando TECLA LIVE corre en HTTPS. */
function httpsOnly(station: RadioStation): boolean {
  return station.url.startsWith("https://");
}

export async function fetchRadioStations(input: {
  query?: string;
  limit?: number;
  countryCode?: string;
}): Promise<RadioStation[]> {
  const query = input.query?.trim() ?? "";
  const limit = Math.min(40, Math.max(1, input.limit ?? 20));
  const countryCode = (input.countryCode ?? "CO").toUpperCase().slice(0, 2);
  const key = `${countryCode}:${limit}:${query.toLowerCase()}`;
  const hit = cache().get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const params = new URLSearchParams({
    limit: String(limit * 2),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
    countrycode: countryCode,
  });
  if (query) params.set("name", query);

  let lastError: unknown;
  for (const mirror of MIRRORS) {
    try {
      const response = await fetch(`${mirror}/json/stations/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "TECLA-LIVE/0.1 (+https://tecla.live)",
        },
        signal: AbortSignal.timeout(7000),
        cache: "no-store",
      });
      if (!response.ok) {
        lastError = new RadioError(
          "RADIO_UPSTREAM_ERROR",
          "La radio no está disponible en este momento.",
          response.status === 429 ? 429 : 502,
        );
        continue;
      }
      const parsed = z.array(RawStationSchema).safeParse(await response.json());
      if (!parsed.success) {
        lastError = new RadioError(
          "RADIO_INVALID_RESPONSE",
          "La radio devolvió una respuesta inesperada.",
        );
        continue;
      }
      const seen = new Set<string>();
      const stations = parsed.data
        .map(toStation)
        .filter((station): station is RadioStation => station !== null)
        .filter(httpsOnly)
        .filter((station) => {
          const dedupe = `${station.name.toLowerCase()}|${station.url}`;
          if (seen.has(dedupe)) return false;
          seen.add(dedupe);
          return true;
        })
        .slice(0, limit);

      cache().set(key, { value: stations, expiresAt: Date.now() + 10 * 60_000 });
      return stations;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof RadioError
    ? lastError
    : new RadioError("RADIO_UNREACHABLE", "No pudimos conectar con el directorio de radio.", 503);
}

export async function fetchRadioStationById(id: string): Promise<RadioStation | null> {
  if (!/^[a-f0-9-]{20,60}$/i.test(id)) return null;
  const key = `station:${id}`;
  const hit = cache().get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value[0] ?? null;

  let lastError: unknown;
  for (const mirror of MIRRORS) {
    try {
      const response = await fetch(
        `${mirror}/json/stations/byuuid/${encodeURIComponent(id)}?hidebroken=true`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "TECLA-LIVE/0.1 (+https://tecla.live)",
          },
          signal: AbortSignal.timeout(7000),
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const parsed = z.array(RawStationSchema).safeParse(await response.json());
      if (!parsed.success) continue;
      const station = parsed.data
        .map(toStation)
        .find((item): item is RadioStation => item !== null && httpsOnly(item));
      const value = station ? [station] : [];
      cache().set(key, { value, expiresAt: Date.now() + 10 * 60_000 });
      return station ?? null;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof RadioError) throw lastError;
  return null;
}
