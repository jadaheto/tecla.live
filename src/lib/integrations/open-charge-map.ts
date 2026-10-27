import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Open Charge Map: estaciones de carga públicas (datos CC BY 4.0, clave
 * gratuita obligatoria). Se consulta desde el servidor con caché de 10
 * minutos por zona; el navegador nunca ve la clave.
 */
export class ChargersError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ChargersError";
    this.code = code;
    this.status = status;
  }
}

export function chargersConfigured(): boolean {
  return Boolean(serverConfig.openChargeMapApiKey);
}

export interface ChargerConnector {
  type: string;
  powerKw: number | null;
  quantity: number | null;
  current: string | null;
}

export interface ChargingStation {
  id: string;
  name: string;
  address: string | null;
  town: string | null;
  operator: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  connectors: ChargerConnector[];
  maxPowerKw: number | null;
  points: number | null;
  operational: boolean | null;
  usage: string | null;
  cost: string | null;
  lastVerified: string | null;
  provider: string | null;
}

const PoiSchema = z.array(
  z.looseObject({
    ID: z.number(),
    UUID: z.string().optional(),
    AddressInfo: z
      .looseObject({
        Title: z.string().nullable().optional(),
        AddressLine1: z.string().nullable().optional(),
        Town: z.string().nullable().optional(),
        Latitude: z.number(),
        Longitude: z.number(),
        Distance: z.number().nullable().optional(),
      })
      .optional(),
    OperatorInfo: z.looseObject({ Title: z.string().nullable().optional() }).nullable().optional(),
    StatusType: z.looseObject({ IsOperational: z.boolean().nullable().optional() }).nullable().optional(),
    UsageType: z.looseObject({ Title: z.string().nullable().optional() }).nullable().optional(),
    DataProvider: z.looseObject({ Title: z.string().nullable().optional() }).nullable().optional(),
    UsageCost: z.string().nullable().optional(),
    NumberOfPoints: z.number().nullable().optional(),
    DateLastVerified: z.string().nullable().optional(),
    Connections: z
      .array(
        z.looseObject({
          ConnectionType: z.looseObject({ Title: z.string().nullable().optional() }).nullable().optional(),
          PowerKW: z.number().nullable().optional(),
          Quantity: z.number().nullable().optional(),
          CurrentType: z.looseObject({ Title: z.string().nullable().optional() }).nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
  }),
);

export type OpenChargeMapPoi = z.infer<typeof PoiSchema>[number];

export function normalizeStation(poi: OpenChargeMapPoi): ChargingStation | null {
  const address = poi.AddressInfo;
  if (!address) return null;
  const connectors: ChargerConnector[] = (poi.Connections ?? []).map((connection) => ({
    type: connection.ConnectionType?.Title?.trim() || "Conector",
    powerKw: typeof connection.PowerKW === "number" ? connection.PowerKW : null,
    quantity: connection.Quantity ?? null,
    current: connection.CurrentType?.Title ?? null,
  }));
  const powers = connectors.map((connector) => connector.powerKw).filter((value): value is number => typeof value === "number");
  return {
    id: String(poi.ID),
    name: address.Title?.trim() || "Estación de carga",
    address: address.AddressLine1?.trim() || null,
    town: address.Town?.trim() || null,
    operator: poi.OperatorInfo?.Title?.trim() || null,
    latitude: address.Latitude,
    longitude: address.Longitude,
    distanceKm: typeof address.Distance === "number" ? Math.round(address.Distance * 10) / 10 : null,
    connectors,
    maxPowerKw: powers.length ? Math.max(...powers) : null,
    points: poi.NumberOfPoints ?? null,
    operational: poi.StatusType?.IsOperational ?? null,
    usage: poi.UsageType?.Title ?? null,
    cost: poi.UsageCost?.trim() || null,
    lastVerified: poi.DateLastVerified ?? null,
    provider: poi.DataProvider?.Title ?? null,
  };
}

/** Clasifica la potencia para colorear el mapa: rápida (≥ 50 kW), media (≥ 22) o lenta. */
export function powerTier(maxPowerKw: number | null): "fast" | "medium" | "slow" | "unknown" {
  if (maxPowerKw === null) return "unknown";
  if (maxPowerKw >= 50) return "fast";
  if (maxPowerKw >= 22) return "medium";
  return "slow";
}

const cache = new Map<string, { stations: ChargingStation[]; at: number }>();
const CACHE_TTL_MS = 10 * 60_000;

export async function findChargingStations(input: { latitude: number; longitude: number; radiusKm: number; maxResults?: number }): Promise<ChargingStation[]> {
  if (!chargersConfigured()) throw new ChargersError("CHARGERS_NOT_CONFIGURED", "Las estaciones de carga no están configuradas (falta OPENCHARGEMAP_API_KEY).", 503);
  const radius = Math.max(2, Math.min(150, input.radiusKm));
  const max = Math.max(5, Math.min(60, input.maxResults ?? 40));
  const key = `${input.latitude.toFixed(3)},${input.longitude.toFixed(3)},${radius},${max}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.stations;

  const params = new URLSearchParams({
    output: "json",
    latitude: input.latitude.toFixed(5),
    longitude: input.longitude.toFixed(5),
    distance: String(radius),
    distanceunit: "km",
    maxresults: String(max),
    compact: "true",
    verbose: "false",
  });
  let response: Response;
  try {
    response = await fetch(`https://api.openchargemap.io/v3/poi/?${params.toString()}`, {
      headers: { "x-api-key": serverConfig.openChargeMapApiKey, Accept: "application/json", "User-Agent": "TECLA LIVE (tecla.live)" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    throw new ChargersError("CHARGERS_UNREACHABLE", "No pudimos conectar con Open Charge Map.", 503);
  }
  if (response.status === 401 || response.status === 403) throw new ChargersError("CHARGERS_KEY_INVALID", "Open Charge Map rechazó la clave configurada.", 502);
  if (response.status === 429) throw new ChargersError("CHARGERS_RATE_LIMITED", "Open Charge Map limitó las consultas por ahora.", 429);
  if (!response.ok) {
    logger.warn("chargers.request_failed", { status: response.status });
    throw new ChargersError("CHARGERS_FAILED", "Open Charge Map devolvió un error.", 502);
  }
  const parsed = PoiSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ChargersError("CHARGERS_INVALID", "Open Charge Map devolvió datos que no reconocemos.", 502);
  const stations = parsed.data
    .map(normalizeStation)
    .filter((station): station is ChargingStation => station !== null)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  cache.set(key, { stations, at: Date.now() });
  return stations;
}
