import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { prisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { logger } from "@/lib/logger";

/**
 * Tesla Fleet API (fase 1: solo lectura). OAuth con la cuenta Tesla del
 * usuario, tokens cifrados en `ConnectedAccount` (provider «tesla») y
 * lectura de batería, carga, clima y estado del vehículo. Los comandos
 * firmados (fase 2) requieren el proxy oficial de Tesla y no están aquí.
 */
export const TESLA_PROVIDER = "tesla";
export const TESLA_AUTH_BASE = "https://auth.tesla.com/oauth2/v3";
export const TESLA_FLEET_BASES = {
  na: "https://fleet-api.prd.na.vn.cloud.tesla.com",
  eu: "https://fleet-api.prd.eu.vn.cloud.tesla.com",
} as const;

/** Permisos pedidos al usuario: datos, ubicación y gestión de carga. `offline_access` da refresh token. */
export const TESLA_DEFAULT_SCOPES = ["openid", "offline_access", "vehicle_device_data", "vehicle_location", "vehicle_charging_cmds"];

/** Minutos que se reutiliza una lectura antes de volver a consultar (cada consulta cuesta). */
export const TESLA_SNAPSHOT_TTL_MS = 2 * 60_000;

export class TeslaError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "TeslaError";
    this.code = code;
    this.status = status;
  }
}

export function teslaConfigured(): boolean {
  return Boolean(serverConfig.teslaClientId && serverConfig.teslaClientSecret);
}

export function teslaStorageConfigured(): boolean {
  return Boolean(serverConfig.tokenEncryptionKey) && isDatabaseConfigured();
}

export function teslaFleetBase(region: "na" | "eu" = serverConfig.teslaRegion): string {
  return TESLA_FLEET_BASES[region];
}

export function teslaScopes(override = serverConfig.teslaScopes): string {
  const extra = override
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return Array.from(new Set([...TESLA_DEFAULT_SCOPES, ...extra])).join(" ");
}

export function buildTeslaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: serverConfig.teslaClientId,
    response_type: "code",
    redirect_uri: serverConfig.teslaRedirectUri,
    scope: teslaScopes(),
    state,
    locale: "es-CO",
    prompt_missing_scopes: "true",
  });
  return `${TESLA_AUTH_BASE}/authorize?${params.toString()}`;
}

const TokenResponseSchema = z.looseObject({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

async function requestToken(body: Record<string, string>): Promise<z.infer<typeof TokenResponseSchema>> {
  let response: Response;
  try {
    response = await fetch(`${TESLA_AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    throw new TeslaError("TESLA_UNREACHABLE", "No pudimos conectar con Tesla. Intenta de nuevo.", 503);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.warn("tesla.token_failed", { status: response.status, detail: detail.slice(0, 300) });
    if (response.status === 400 || response.status === 401) {
      throw new TeslaError("TESLA_REAUTH_REQUIRED", "La autorización de Tesla expiró o fue rechazada. Vuelve a vincular tu cuenta.", 401);
    }
    throw new TeslaError("TESLA_AUTH_ERROR", "Tesla rechazó la autorización.", 502);
  }
  const parsed = TokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new TeslaError("TESLA_INVALID_RESPONSE", "Tesla devolvió una respuesta inesperada.", 502);
  return parsed.data;
}

/** Identificador estable del usuario de Tesla, leído del JWT sin verificar (solo para mostrar). */
export function subjectFromJwt(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

export async function saveTeslaAccount(input: { userId: string; code: string }): Promise<void> {
  const tokens = await requestToken({
    grant_type: "authorization_code",
    client_id: serverConfig.teslaClientId,
    client_secret: serverConfig.teslaClientSecret,
    code: input.code,
    redirect_uri: serverConfig.teslaRedirectUri,
    audience: teslaFleetBase(),
  });
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
  await prisma.connectedAccount.upsert({
    where: { userId_provider: { userId: input.userId, provider: TESLA_PROVIDER } },
    create: {
      userId: input.userId,
      provider: TESLA_PROVIDER,
      providerAccountId: subjectFromJwt(tokens.access_token) ?? "tesla",
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
      scope: teslaScopes(),
    },
    update: {
      providerAccountId: subjectFromJwt(tokens.access_token) ?? "tesla",
      accessToken: encryptToken(tokens.access_token),
      ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
      expiresAt,
      scope: teslaScopes(),
    },
  });
  snapshotCache.delete(input.userId);
  logger.info("tesla.account_connected", { userId: input.userId });
}

export async function getTeslaAccessToken(userId: string): Promise<string> {
  if (!teslaConfigured()) throw new TeslaError("TESLA_NOT_CONFIGURED", "Tesla no está configurado en el servidor.", 503);
  if (!teslaStorageConfigured()) {
    throw new TeslaError("TESLA_STORAGE_NOT_CONFIGURED", "Falta TOKEN_ENCRYPTION_KEY o la base de datos para vincular Tesla.", 503);
  }
  const account = await prisma.connectedAccount.findUnique({
    where: { userId_provider: { userId, provider: TESLA_PROVIDER } },
  });
  if (!account) throw new TeslaError("TESLA_NOT_CONNECTED", "Tu cuenta de Tesla no está vinculada. Hazlo en Ajustes → Mi Tesla.", 401);

  const expiresSoon = account.expiresAt !== null && account.expiresAt.getTime() < Date.now() + 60_000;
  if (!expiresSoon) {
    try {
      return decryptToken(account.accessToken);
    } catch {
      throw new TeslaError("TESLA_TOKEN_INVALID", "No pudimos leer el token de Tesla. Vuelve a vincular tu cuenta.", 401);
    }
  }
  if (!account.refreshToken) throw new TeslaError("TESLA_REAUTH_REQUIRED", "La sesión de Tesla expiró. Vuelve a vincular tu cuenta.", 401);
  let refreshToken: string;
  try {
    refreshToken = decryptToken(account.refreshToken);
  } catch {
    throw new TeslaError("TESLA_REAUTH_REQUIRED", "No pudimos renovar Tesla. Vuelve a vincular tu cuenta.", 401);
  }
  const refreshed = await requestToken({
    grant_type: "refresh_token",
    client_id: serverConfig.teslaClientId,
    refresh_token: refreshToken,
  });
  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encryptToken(refreshed.access_token),
      ...(refreshed.refresh_token ? { refreshToken: encryptToken(refreshed.refresh_token) } : {}),
      expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
    },
  });
  return refreshed.access_token;
}

export async function disconnectTesla(userId: string): Promise<void> {
  snapshotCache.delete(userId);
  await prisma.connectedAccount.deleteMany({ where: { userId, provider: TESLA_PROVIDER } });
}

async function teslaFetch<T>(userId: string, path: string, init: RequestInit = {}, schema?: z.ZodType<T>): Promise<{ status: number; data: T | null }> {
  const token = await getTeslaAccessToken(userId);
  let response: Response;
  try {
    response = await fetch(`${teslaFleetBase()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new TeslaError("TESLA_UNREACHABLE", "No pudimos conectar con la Fleet API de Tesla.", 503);
  }
  if (response.status === 401) throw new TeslaError("TESLA_REAUTH_REQUIRED", "Tesla rechazó el token. Vuelve a vincular tu cuenta.", 401);
  if (response.status === 403) {
    throw new TeslaError("TESLA_FORBIDDEN", "Tesla no permitió esta lectura. Revisa los permisos de la app o el registro del dominio.", 403);
  }
  if (response.status === 408) return { status: 408, data: null };
  if (response.status === 429) throw new TeslaError("TESLA_RATE_LIMITED", "Tesla limitó las consultas por ahora. Espera un momento.", 429);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    logger.warn("tesla.request_failed", { path, status: response.status, detail: detail.slice(0, 300) });
    throw new TeslaError("TESLA_REQUEST_FAILED", "Tesla devolvió un error inesperado.", 502);
  }
  const json = (await response.json().catch(() => null)) as unknown;
  if (!schema) return { status: response.status, data: json as T };
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.warn("tesla.invalid_payload", { path });
    throw new TeslaError("TESLA_INVALID_RESPONSE", "Tesla devolvió datos que no reconocemos.", 502);
  }
  return { status: response.status, data: parsed.data };
}

const VehiclesSchema = z.looseObject({
  response: z.array(
    z.looseObject({
      id_s: z.string().optional(),
      id: z.number().optional(),
      vin: z.string().optional(),
      display_name: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
    }),
  ),
});

export interface TeslaVehicleRef {
  id: string;
  vin: string | null;
  name: string | null;
  state: string | null;
}

export async function listTeslaVehicles(userId: string): Promise<TeslaVehicleRef[]> {
  const { data } = await teslaFetch(userId, "/api/1/vehicles", {}, VehiclesSchema);
  return (data?.response ?? [])
    .map((vehicle) => ({
      id: vehicle.id_s ?? (vehicle.id !== undefined ? String(vehicle.id) : ""),
      vin: vehicle.vin ?? null,
      name: vehicle.display_name ?? null,
      state: vehicle.state ?? null,
    }))
    .filter((vehicle) => vehicle.id);
}

const VehicleDataSchema = z.looseObject({
  response: z.looseObject({
    id_s: z.string().optional(),
    vin: z.string().optional(),
    display_name: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    charge_state: z
      .looseObject({
        battery_level: z.number().nullable().optional(),
        usable_battery_level: z.number().nullable().optional(),
        battery_range: z.number().nullable().optional(),
        est_battery_range: z.number().nullable().optional(),
        charging_state: z.string().nullable().optional(),
        charge_limit_soc: z.number().nullable().optional(),
        time_to_full_charge: z.number().nullable().optional(),
        charger_power: z.number().nullable().optional(),
        charge_rate: z.number().nullable().optional(),
        charge_port_door_open: z.boolean().nullable().optional(),
        minutes_to_full_charge: z.number().nullable().optional(),
      })
      .optional(),
    climate_state: z
      .looseObject({
        inside_temp: z.number().nullable().optional(),
        outside_temp: z.number().nullable().optional(),
        is_climate_on: z.boolean().nullable().optional(),
        is_preconditioning: z.boolean().nullable().optional(),
      })
      .optional(),
    drive_state: z
      .looseObject({
        speed: z.number().nullable().optional(),
        shift_state: z.string().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
        heading: z.number().nullable().optional(),
      })
      .optional(),
    vehicle_state: z
      .looseObject({
        locked: z.boolean().nullable().optional(),
        odometer: z.number().nullable().optional(),
        sentry_mode: z.boolean().nullable().optional(),
        car_version: z.string().nullable().optional(),
        vehicle_name: z.string().nullable().optional(),
        is_user_present: z.boolean().nullable().optional(),
      })
      .optional(),
  }),
});

export type TeslaChargingState = "charging" | "complete" | "stopped" | "disconnected" | "no_power" | "unknown";

export interface TeslaSnapshot {
  vehicleId: string;
  vin: string | null;
  name: string | null;
  /** «online», «asleep», «offline»… según Tesla. */
  state: string | null;
  asleep: boolean;
  batteryPercent: number | null;
  rangeKm: number | null;
  charging: TeslaChargingState;
  chargeLimitPercent: number | null;
  minutesToFull: number | null;
  chargerPowerKw: number | null;
  pluggedIn: boolean;
  insideTempC: number | null;
  outsideTempC: number | null;
  climateOn: boolean;
  locked: boolean | null;
  odometerKm: number | null;
  speedKmh: number | null;
  shiftState: string | null;
  location: { latitude: number; longitude: number } | null;
  softwareVersion: string | null;
  sentryMode: boolean | null;
  observedAt: string;
  /** La lectura viene de la caché del servidor (no se consultó a Tesla). */
  cached: boolean;
}

const MILES_TO_KM = 1.609344;

export function normalizeChargingState(raw: string | null | undefined): TeslaChargingState {
  switch ((raw ?? "").toLowerCase()) {
    case "charging":
      return "charging";
    case "complete":
      return "complete";
    case "stopped":
      return "stopped";
    case "disconnected":
      return "disconnected";
    case "nopower":
      return "no_power";
    default:
      return "unknown";
  }
}

/** Convierte la respuesta cruda de `vehicle_data` a unidades métricas y campos estables. */
export function normalizeVehicleData(raw: z.infer<typeof VehicleDataSchema>["response"], fallback: TeslaVehicleRef, observedAt = new Date()): TeslaSnapshot {
  const charge = raw.charge_state ?? {};
  const climate = raw.climate_state ?? {};
  const drive = raw.drive_state ?? {};
  const vehicle = raw.vehicle_state ?? {};
  const km = (miles: number | null | undefined) => (typeof miles === "number" ? Math.round(miles * MILES_TO_KM) : null);
  const charging = normalizeChargingState(charge.charging_state);
  const minutesToFull =
    typeof charge.minutes_to_full_charge === "number"
      ? charge.minutes_to_full_charge
      : typeof charge.time_to_full_charge === "number"
        ? Math.round(charge.time_to_full_charge * 60)
        : null;
  return {
    vehicleId: raw.id_s ?? fallback.id,
    vin: raw.vin ?? fallback.vin,
    name: raw.display_name ?? vehicle.vehicle_name ?? fallback.name,
    state: raw.state ?? fallback.state,
    asleep: false,
    batteryPercent: charge.battery_level ?? charge.usable_battery_level ?? null,
    rangeKm: km(charge.battery_range ?? charge.est_battery_range),
    charging,
    chargeLimitPercent: charge.charge_limit_soc ?? null,
    minutesToFull: charging === "charging" ? minutesToFull : null,
    chargerPowerKw: charging === "charging" ? (charge.charger_power ?? null) : null,
    pluggedIn: charging !== "disconnected" && charging !== "unknown",
    insideTempC: climate.inside_temp ?? null,
    outsideTempC: climate.outside_temp ?? null,
    climateOn: Boolean(climate.is_climate_on || climate.is_preconditioning),
    locked: vehicle.locked ?? null,
    odometerKm: km(vehicle.odometer),
    speedKmh: typeof drive.speed === "number" ? Math.round(drive.speed * MILES_TO_KM) : null,
    shiftState: drive.shift_state ?? null,
    location: typeof drive.latitude === "number" && typeof drive.longitude === "number" ? { latitude: drive.latitude, longitude: drive.longitude } : null,
    softwareVersion: vehicle.car_version ?? null,
    sentryMode: vehicle.sentry_mode ?? null,
    observedAt: observedAt.toISOString(),
    cached: false,
  };
}

export function asleepSnapshot(vehicle: TeslaVehicleRef, observedAt = new Date()): TeslaSnapshot {
  return {
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    name: vehicle.name,
    state: vehicle.state ?? "asleep",
    asleep: true,
    batteryPercent: null,
    rangeKm: null,
    charging: "unknown",
    chargeLimitPercent: null,
    minutesToFull: null,
    chargerPowerKw: null,
    pluggedIn: false,
    insideTempC: null,
    outsideTempC: null,
    climateOn: false,
    locked: null,
    odometerKm: null,
    speedKmh: null,
    shiftState: null,
    location: null,
    softwareVersion: null,
    sentryMode: null,
    observedAt: observedAt.toISOString(),
    cached: false,
  };
}

interface CacheEntry {
  snapshot: TeslaSnapshot;
  at: number;
}

const globalCache = globalThis as unknown as { __teclaTeslaCache?: Map<string, CacheEntry> };
const snapshotCache: Map<string, CacheEntry> = globalCache.__teclaTeslaCache ?? (globalCache.__teclaTeslaCache = new Map());

/**
 * Lectura del vehículo principal del usuario. Reutiliza la caché del servidor
 * durante 2 minutos salvo `force`. Si el auto duerme, lo dice sin despertarlo
 * (despertarlo gasta batería y es una decisión del usuario).
 */
export async function getTeslaSnapshot(userId: string, options: { force?: boolean } = {}): Promise<TeslaSnapshot> {
  const cached = snapshotCache.get(userId);
  if (!options.force && cached && Date.now() - cached.at < TESLA_SNAPSHOT_TTL_MS) {
    return { ...cached.snapshot, cached: true };
  }
  const vehicles = await listTeslaVehicles(userId);
  const vehicle = vehicles[0];
  if (!vehicle) throw new TeslaError("TESLA_NO_VEHICLE", "Tu cuenta de Tesla no tiene vehículos asociados.", 404);
  if (vehicle.state && vehicle.state !== "online") {
    const snapshot = asleepSnapshot(vehicle);
    snapshotCache.set(userId, { snapshot, at: Date.now() });
    return snapshot;
  }
  const { status, data } = await teslaFetch(
    userId,
    `/api/1/vehicles/${encodeURIComponent(vehicle.id)}/vehicle_data?endpoints=${encodeURIComponent("charge_state;climate_state;drive_state;vehicle_state")}`,
    {},
    VehicleDataSchema,
  );
  const snapshot = status === 408 || !data ? asleepSnapshot(vehicle) : normalizeVehicleData(data.response, vehicle);
  snapshotCache.set(userId, { snapshot, at: Date.now() });
  return snapshot;
}

/** Pide al vehículo que despierte. Tesla responde enseguida; el auto tarda unos segundos. */
export async function wakeTeslaVehicle(userId: string): Promise<{ state: string | null }> {
  const vehicles = await listTeslaVehicles(userId);
  const vehicle = vehicles[0];
  if (!vehicle) throw new TeslaError("TESLA_NO_VEHICLE", "Tu cuenta de Tesla no tiene vehículos asociados.", 404);
  const { data } = await teslaFetch(userId, `/api/1/vehicles/${encodeURIComponent(vehicle.id)}/wake_up`, { method: "POST" }, z.looseObject({ response: z.looseObject({ state: z.string().nullable().optional() }).optional() }));
  snapshotCache.delete(userId);
  return { state: data?.response?.state ?? null };
}

/**
 * Registro de socio: una sola vez por app, declara ante Tesla el dominio que
 * aloja la llave pública (`/.well-known/appspecific/com.tesla.3p.public-key.pem`).
 * Usa un token de aplicación (client_credentials), no el de un usuario.
 */
export async function registerTeslaPartner(): Promise<{ ok: boolean; status: number; detail: string }> {
  if (!teslaConfigured()) throw new TeslaError("TESLA_NOT_CONFIGURED", "Faltan TESLA_CLIENT_ID y TESLA_CLIENT_SECRET.", 503);
  const token = await requestToken({
    grant_type: "client_credentials",
    client_id: serverConfig.teslaClientId,
    client_secret: serverConfig.teslaClientSecret,
    scope: teslaScopes(),
    audience: teslaFleetBase(),
  });
  const response = await fetch(`${teslaFleetBase()}/api/1/partner_accounts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ domain: serverConfig.teslaDomain }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const detail = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, detail: detail.slice(0, 600) };
}
