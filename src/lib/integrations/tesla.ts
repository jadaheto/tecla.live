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
/** Con el auto dormido se consulta mucho menos: cada lectura cuesta igual aunque solo diga «durmiendo». */
export const TESLA_ASLEEP_TTL_MS = 10 * 60_000;

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

const vehiclesCache = new Map<string, { vehicles: TeslaVehicleRef[]; at: number }>();
/** La lista de vehículos casi no cambia: se reutiliza 1 hora para no pagar una consulta extra por lectura. */
const VEHICLES_TTL_MS = 60 * 60_000;

export async function listTeslaVehicles(userId: string, options: { force?: boolean } = {}): Promise<TeslaVehicleRef[]> {
  const cached = vehiclesCache.get(userId);
  if (!options.force && cached && Date.now() - cached.at < VEHICLES_TTL_MS) return cached.vehicles;
  const { data } = await teslaFetch(userId, "/api/1/vehicles", {}, VehiclesSchema);
  const vehicles = (data?.response ?? [])
    .map((vehicle) => ({
      id: vehicle.id_s ?? (vehicle.id !== undefined ? String(vehicle.id) : ""),
      vin: vehicle.vin ?? null,
      name: vehicle.display_name ?? null,
      state: vehicle.state ?? null,
    }))
    .filter((vehicle) => vehicle.id);
  vehiclesCache.set(userId, { vehicles, at: Date.now() });
  return vehicles;
}

const DoorFlag = z.number().nullable().optional();
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
        ideal_battery_range: z.number().nullable().optional(),
        charging_state: z.string().nullable().optional(),
        charge_limit_soc: z.number().nullable().optional(),
        charge_limit_soc_max: z.number().nullable().optional(),
        time_to_full_charge: z.number().nullable().optional(),
        minutes_to_full_charge: z.number().nullable().optional(),
        charger_power: z.number().nullable().optional(),
        charger_voltage: z.number().nullable().optional(),
        charger_actual_current: z.number().nullable().optional(),
        charge_amps: z.number().nullable().optional(),
        charge_current_request_max: z.number().nullable().optional(),
        charge_rate: z.number().nullable().optional(),
        charge_energy_added: z.number().nullable().optional(),
        charge_miles_added_rated: z.number().nullable().optional(),
        charge_port_door_open: z.boolean().nullable().optional(),
        charge_port_latch: z.string().nullable().optional(),
        conn_charge_cable: z.string().nullable().optional(),
        fast_charger_present: z.boolean().nullable().optional(),
        fast_charger_type: z.string().nullable().optional(),
        scheduled_charging_mode: z.string().nullable().optional(),
        scheduled_charging_start_time: z.number().nullable().optional(),
        scheduled_departure_time: z.number().nullable().optional(),
        battery_heater_on: z.boolean().nullable().optional(),
        preconditioning_enabled: z.boolean().nullable().optional(),
      })
      .optional(),
    climate_state: z
      .looseObject({
        inside_temp: z.number().nullable().optional(),
        outside_temp: z.number().nullable().optional(),
        is_climate_on: z.boolean().nullable().optional(),
        is_preconditioning: z.boolean().nullable().optional(),
        is_auto_conditioning_on: z.boolean().nullable().optional(),
        driver_temp_setting: z.number().nullable().optional(),
        passenger_temp_setting: z.number().nullable().optional(),
        fan_status: z.number().nullable().optional(),
        seat_heater_left: z.number().nullable().optional(),
        seat_heater_right: z.number().nullable().optional(),
        seat_heater_rear_left: z.number().nullable().optional(),
        seat_heater_rear_center: z.number().nullable().optional(),
        seat_heater_rear_right: z.number().nullable().optional(),
        steering_wheel_heater: z.boolean().nullable().optional(),
        is_front_defroster_on: z.boolean().nullable().optional(),
        is_rear_defroster_on: z.boolean().nullable().optional(),
        cabin_overheat_protection: z.string().nullable().optional(),
        climate_keeper_mode: z.string().nullable().optional(),
      })
      .optional(),
    drive_state: z
      .looseObject({
        speed: z.number().nullable().optional(),
        power: z.number().nullable().optional(),
        shift_state: z.string().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
        heading: z.number().nullable().optional(),
        gps_as_of: z.number().nullable().optional(),
      })
      .optional(),
    vehicle_state: z
      .looseObject({
        locked: z.boolean().nullable().optional(),
        odometer: z.number().nullable().optional(),
        sentry_mode: z.boolean().nullable().optional(),
        sentry_mode_available: z.boolean().nullable().optional(),
        car_version: z.string().nullable().optional(),
        vehicle_name: z.string().nullable().optional(),
        is_user_present: z.boolean().nullable().optional(),
        valet_mode: z.boolean().nullable().optional(),
        df: DoorFlag,
        dr: DoorFlag,
        pf: DoorFlag,
        pr: DoorFlag,
        ft: DoorFlag,
        rt: DoorFlag,
        fd_window: DoorFlag,
        fp_window: DoorFlag,
        rd_window: DoorFlag,
        rp_window: DoorFlag,
        tpms_pressure_fl: z.number().nullable().optional(),
        tpms_pressure_fr: z.number().nullable().optional(),
        tpms_pressure_rl: z.number().nullable().optional(),
        tpms_pressure_rr: z.number().nullable().optional(),
        tpms_soft_warning_fl: z.boolean().nullable().optional(),
        tpms_soft_warning_fr: z.boolean().nullable().optional(),
        tpms_soft_warning_rl: z.boolean().nullable().optional(),
        tpms_soft_warning_rr: z.boolean().nullable().optional(),
        dashcam_state: z.string().nullable().optional(),
        center_display_state: z.number().nullable().optional(),
        remote_start: z.boolean().nullable().optional(),
        software_update: z
          .looseObject({
            status: z.string().nullable().optional(),
            version: z.string().nullable().optional(),
            download_perc: z.number().nullable().optional(),
            install_perc: z.number().nullable().optional(),
            expected_duration_sec: z.number().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .optional(),
    vehicle_config: z
      .looseObject({
        car_type: z.string().nullable().optional(),
        trim_badging: z.string().nullable().optional(),
        exterior_color: z.string().nullable().optional(),
        wheel_type: z.string().nullable().optional(),
        roof_color: z.string().nullable().optional(),
        charge_port_type: z.string().nullable().optional(),
        interior_trim_type: z.string().nullable().optional(),
        eu_vehicle: z.boolean().nullable().optional(),
        rhd: z.boolean().nullable().optional(),
        plg: z.boolean().nullable().optional(),
      })
      .optional(),
    gui_settings: z
      .looseObject({
        gui_distance_units: z.string().nullable().optional(),
        gui_temperature_units: z.string().nullable().optional(),
        gui_charge_rate_units: z.string().nullable().optional(),
        gui_24_hour_time: z.boolean().nullable().optional(),
        gui_range_display: z.string().nullable().optional(),
      })
      .optional(),
  }),
});

export type TeslaVehicleRaw = z.infer<typeof VehicleDataSchema>["response"];

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
  /** Hay alguien dentro del auto (según Tesla). */
  userPresent: boolean | null;
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
    userPresent: vehicle.is_user_present ?? null,
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
    userPresent: null,
    observedAt: observedAt.toISOString(),
    cached: false,
  };
}

interface CacheEntry {
  vehicle: TeslaVehicleRef;
  raw: TeslaVehicleRaw | null;
  at: number;
}

const globalCache = globalThis as unknown as { __teclaTeslaCache?: Map<string, CacheEntry> };
const snapshotCache: Map<string, CacheEntry> = globalCache.__teclaTeslaCache ?? (globalCache.__teclaTeslaCache = new Map());

const ALL_ENDPOINTS = "charge_state;climate_state;drive_state;vehicle_state;vehicle_config;gui_settings";

/**
 * Lectura cruda del vehículo principal del usuario (todos los endpoints que
 * permiten los permisos de lectura), con caché de 2 minutos salvo `force`.
 * `raw` es null cuando el auto duerme: no se despierta solo.
 */
async function fetchVehicleRaw(userId: string, force: boolean): Promise<{ entry: CacheEntry; cached: boolean }> {
  const cached = snapshotCache.get(userId);
  // Despierto: 2 min. Dormido: 10 min, para no pagar lecturas que solo devuelven «durmiendo».
  const ttl = cached?.raw ? TESLA_SNAPSHOT_TTL_MS : TESLA_ASLEEP_TTL_MS;
  if (!force && cached && Date.now() - cached.at < ttl) return { entry: cached, cached: true };
  const vehicles = await listTeslaVehicles(userId);
  const vehicle = vehicles[0];
  if (!vehicle) throw new TeslaError("TESLA_NO_VEHICLE", "Tu cuenta de Tesla no tiene vehículos asociados.", 404);
  const { status, data } = await teslaFetch(
    userId,
    `/api/1/vehicles/${encodeURIComponent(vehicle.id)}/vehicle_data?endpoints=${encodeURIComponent(ALL_ENDPOINTS)}`,
    {},
    VehicleDataSchema,
  );
  const entry = {
    vehicle: status === 408 || !data ? { ...vehicle, state: "asleep" } : { ...vehicle, state: data.response.state ?? "online" },
    raw: status === 408 || !data ? null : data.response,
    at: Date.now(),
  };
  snapshotCache.set(userId, entry);
  return { entry, cached: false };
}

/** Resumen del vehículo (tarjeta, arranque, Pantalla ambiente, TECLA AI). */
export async function getTeslaSnapshot(userId: string, options: { force?: boolean } = {}): Promise<TeslaSnapshot> {
  const { entry, cached } = await fetchVehicleRaw(userId, options.force === true);
  const snapshot = entry.raw ? normalizeVehicleData(entry.raw, entry.vehicle, new Date(entry.at)) : asleepSnapshot(entry.vehicle, new Date(entry.at));
  return { ...snapshot, cached };
}

/* ---------- Detalle completo para la pantalla «Mi Tesla» ---------- */
export interface TeslaDetail {
  summary: TeslaSnapshot;
  identity: {
    vin: string | null;
    model: string | null;
    trim: string | null;
    exteriorColor: string | null;
    wheels: string | null;
    roof: string | null;
    chargePortType: string | null;
    interior: string | null;
    euVehicle: boolean | null;
    rightHandDrive: boolean | null;
  };
  charge: {
    usablePercent: number | null;
    estRangeKm: number | null;
    idealRangeKm: number | null;
    limitMaxPercent: number | null;
    voltage: number | null;
    currentA: number | null;
    requestedAmps: number | null;
    maxAmps: number | null;
    rateKmh: number | null;
    energyAddedKwh: number | null;
    rangeAddedKm: number | null;
    portOpen: boolean | null;
    portLatch: string | null;
    cable: string | null;
    fastCharger: boolean | null;
    fastChargerType: string | null;
    scheduledMode: string | null;
    scheduledStartMinutes: number | null;
    scheduledDepartureMinutes: number | null;
    batteryHeater: boolean | null;
    preconditioning: boolean | null;
  };
  climate: {
    driverSetC: number | null;
    passengerSetC: number | null;
    fan: number | null;
    auto: boolean | null;
    seatHeaters: { frontLeft: number | null; frontRight: number | null; rearLeft: number | null; rearCenter: number | null; rearRight: number | null };
    steeringHeater: boolean | null;
    frontDefrost: boolean | null;
    rearDefrost: boolean | null;
    cabinOverheatProtection: string | null;
    keeperMode: string | null;
  };
  body: {
    doors: { frontLeft: boolean | null; frontRight: boolean | null; rearLeft: boolean | null; rearRight: boolean | null };
    trunks: { front: boolean | null; rear: boolean | null };
    windows: { frontLeft: boolean | null; frontRight: boolean | null; rearLeft: boolean | null; rearRight: boolean | null };
    valetMode: boolean | null;
    sentryAvailable: boolean | null;
    dashcam: string | null;
    remoteStart: boolean | null;
  };
  tyres: {
    frontLeftBar: number | null;
    frontRightBar: number | null;
    rearLeftBar: number | null;
    rearRightBar: number | null;
    warnings: { frontLeft: boolean; frontRight: boolean; rearLeft: boolean; rearRight: boolean };
  };
  drive: {
    heading: number | null;
    powerKw: number | null;
    gpsAt: string | null;
  };
  software: {
    version: string | null;
    updateStatus: string | null;
    updateVersion: string | null;
    downloadPercent: number | null;
    installPercent: number | null;
    expectedMinutes: number | null;
  };
  units: {
    distance: string | null;
    temperature: string | null;
    chargeRate: string | null;
    time24h: boolean | null;
    range: string | null;
  };
}

const MODEL_NAMES: Record<string, string> = {
  models: "Model S",
  models2: "Model S",
  model3: "Model 3",
  modelx: "Model X",
  modely: "Model Y",
  lychee: "Model S",
  tamarind: "Model X",
  cybertruck: "Cybertruck",
};

export function teslaModelName(carType: string | null | undefined): string | null {
  if (!carType) return null;
  return MODEL_NAMES[carType.toLowerCase()] ?? carType;
}

function flag(value: number | null | undefined): boolean | null {
  return typeof value === "number" ? value !== 0 : null;
}

export function normalizeVehicleDetail(raw: TeslaVehicleRaw, vehicle: TeslaVehicleRef, observedAt = new Date()): TeslaDetail {
  const charge = raw.charge_state ?? {};
  const climate = raw.climate_state ?? {};
  const drive = raw.drive_state ?? {};
  const state = raw.vehicle_state ?? {};
  const config = raw.vehicle_config ?? {};
  const gui = raw.gui_settings ?? {};
  const km = (miles: number | null | undefined) => (typeof miles === "number" ? Math.round(miles * MILES_TO_KM) : null);
  const update = state.software_update ?? null;
  return {
    summary: normalizeVehicleData(raw, vehicle, observedAt),
    identity: {
      vin: raw.vin ?? vehicle.vin,
      model: teslaModelName(config.car_type),
      trim: config.trim_badging ?? null,
      exteriorColor: config.exterior_color ?? null,
      wheels: config.wheel_type ?? null,
      roof: config.roof_color ?? null,
      chargePortType: config.charge_port_type ?? null,
      interior: config.interior_trim_type ?? null,
      euVehicle: config.eu_vehicle ?? null,
      rightHandDrive: config.rhd ?? null,
    },
    charge: {
      usablePercent: charge.usable_battery_level ?? null,
      estRangeKm: km(charge.est_battery_range),
      idealRangeKm: km(charge.ideal_battery_range),
      limitMaxPercent: charge.charge_limit_soc_max ?? null,
      voltage: charge.charger_voltage ?? null,
      currentA: charge.charger_actual_current ?? null,
      requestedAmps: charge.charge_amps ?? null,
      maxAmps: charge.charge_current_request_max ?? null,
      rateKmh: km(charge.charge_rate),
      energyAddedKwh: charge.charge_energy_added ?? null,
      rangeAddedKm: km(charge.charge_miles_added_rated),
      portOpen: charge.charge_port_door_open ?? null,
      portLatch: charge.charge_port_latch ?? null,
      cable: charge.conn_charge_cable ?? null,
      fastCharger: charge.fast_charger_present ?? null,
      fastChargerType: charge.fast_charger_type ?? null,
      scheduledMode: charge.scheduled_charging_mode ?? null,
      scheduledStartMinutes: charge.scheduled_charging_start_time ?? null,
      scheduledDepartureMinutes: charge.scheduled_departure_time ?? null,
      batteryHeater: charge.battery_heater_on ?? null,
      preconditioning: charge.preconditioning_enabled ?? null,
    },
    climate: {
      driverSetC: climate.driver_temp_setting ?? null,
      passengerSetC: climate.passenger_temp_setting ?? null,
      fan: climate.fan_status ?? null,
      auto: climate.is_auto_conditioning_on ?? null,
      seatHeaters: {
        frontLeft: climate.seat_heater_left ?? null,
        frontRight: climate.seat_heater_right ?? null,
        rearLeft: climate.seat_heater_rear_left ?? null,
        rearCenter: climate.seat_heater_rear_center ?? null,
        rearRight: climate.seat_heater_rear_right ?? null,
      },
      steeringHeater: climate.steering_wheel_heater ?? null,
      frontDefrost: climate.is_front_defroster_on ?? null,
      rearDefrost: climate.is_rear_defroster_on ?? null,
      cabinOverheatProtection: climate.cabin_overheat_protection ?? null,
      keeperMode: climate.climate_keeper_mode ?? null,
    },
    body: {
      doors: { frontLeft: flag(state.df), frontRight: flag(state.pf), rearLeft: flag(state.dr), rearRight: flag(state.pr) },
      trunks: { front: flag(state.ft), rear: flag(state.rt) },
      windows: { frontLeft: flag(state.fd_window), frontRight: flag(state.fp_window), rearLeft: flag(state.rd_window), rearRight: flag(state.rp_window) },
      valetMode: state.valet_mode ?? null,
      sentryAvailable: state.sentry_mode_available ?? null,
      dashcam: state.dashcam_state ?? null,
      remoteStart: state.remote_start ?? null,
    },
    tyres: {
      frontLeftBar: state.tpms_pressure_fl ?? null,
      frontRightBar: state.tpms_pressure_fr ?? null,
      rearLeftBar: state.tpms_pressure_rl ?? null,
      rearRightBar: state.tpms_pressure_rr ?? null,
      warnings: {
        frontLeft: state.tpms_soft_warning_fl ?? false,
        frontRight: state.tpms_soft_warning_fr ?? false,
        rearLeft: state.tpms_soft_warning_rl ?? false,
        rearRight: state.tpms_soft_warning_rr ?? false,
      },
    },
    drive: {
      heading: drive.heading ?? null,
      powerKw: drive.power ?? null,
      gpsAt: typeof drive.gps_as_of === "number" ? new Date(drive.gps_as_of * 1000).toISOString() : null,
    },
    software: {
      version: state.car_version ?? null,
      updateStatus: update?.status || null,
      updateVersion: update?.version || null,
      downloadPercent: update?.download_perc ?? null,
      installPercent: update?.install_perc ?? null,
      expectedMinutes: typeof update?.expected_duration_sec === "number" ? Math.round(update.expected_duration_sec / 60) : null,
    },
    units: {
      distance: gui.gui_distance_units ?? null,
      temperature: gui.gui_temperature_units ?? null,
      chargeRate: gui.gui_charge_rate_units ?? null,
      time24h: gui.gui_24_hour_time ?? null,
      range: gui.gui_range_display ?? null,
    },
  };
}

/** Detalle completo; si el auto duerme devuelve solo el resumen dormido (`detail` null). */
export async function getTeslaDetail(userId: string, options: { force?: boolean } = {}): Promise<{ summary: TeslaSnapshot; detail: TeslaDetail | null }> {
  const { entry, cached } = await fetchVehicleRaw(userId, options.force === true);
  if (!entry.raw) return { summary: { ...asleepSnapshot(entry.vehicle, new Date(entry.at)), cached }, detail: null };
  const detail = normalizeVehicleDetail(entry.raw, entry.vehicle, new Date(entry.at));
  return { summary: { ...detail.summary, cached }, detail };
}

/* ---------- Supercargadores cercanos e historial de carga ---------- */
export interface TeslaChargingSite {
  name: string;
  type: string;
  distanceKm: number | null;
  availableStalls: number | null;
  totalStalls: number | null;
  closed: boolean;
  location: { latitude: number; longitude: number } | null;
}

const NearbySchema = z.looseObject({
  response: z.looseObject({
    superchargers: z
      .array(
        z.looseObject({
          name: z.string().nullable().optional(),
          type: z.string().nullable().optional(),
          distance_miles: z.number().nullable().optional(),
          available_stalls: z.number().nullable().optional(),
          total_stalls: z.number().nullable().optional(),
          site_closed: z.boolean().nullable().optional(),
          location: z.looseObject({ lat: z.number().optional(), long: z.number().optional() }).nullable().optional(),
        }),
      )
      .optional(),
    destination_charging: z
      .array(
        z.looseObject({
          name: z.string().nullable().optional(),
          type: z.string().nullable().optional(),
          distance_miles: z.number().nullable().optional(),
          location: z.looseObject({ lat: z.number().optional(), long: z.number().optional() }).nullable().optional(),
        }),
      )
      .optional(),
  }),
});

const sitesCache = new Map<string, { sites: { superchargers: TeslaChargingSite[]; destinations: TeslaChargingSite[] }; at: number }>();
const SITES_TTL_MS = 10 * 60_000;

/** Cargadores cercanos a la posición del auto (requiere auto despierto). */
export async function getTeslaNearbyChargers(userId: string): Promise<{ superchargers: TeslaChargingSite[]; destinations: TeslaChargingSite[]; asleep: boolean }> {
  const cached = sitesCache.get(userId);
  if (cached && Date.now() - cached.at < SITES_TTL_MS) return { ...cached.sites, asleep: false };
  const { entry } = await fetchVehicleRaw(userId, false);
  if (!entry.raw) return { superchargers: [], destinations: [], asleep: true };
  const { status, data } = await teslaFetch(userId, `/api/1/vehicles/${encodeURIComponent(entry.vehicle.id)}/nearby_charging_sites?count=8&radius=60&detail=true`, {}, NearbySchema);
  if (status === 408 || !data) return { superchargers: [], destinations: [], asleep: true };
  const toSite = (site: { name?: string | null; type?: string | null; distance_miles?: number | null; available_stalls?: number | null; total_stalls?: number | null; site_closed?: boolean | null; location?: { lat?: number; long?: number } | null }): TeslaChargingSite => ({
    name: site.name ?? "Cargador",
    type: site.type ?? "charger",
    distanceKm: typeof site.distance_miles === "number" ? Math.round(site.distance_miles * MILES_TO_KM * 10) / 10 : null,
    availableStalls: site.available_stalls ?? null,
    totalStalls: site.total_stalls ?? null,
    closed: site.site_closed ?? false,
    location: typeof site.location?.lat === "number" && typeof site.location?.long === "number" ? { latitude: site.location.lat, longitude: site.location.long } : null,
  });
  const sites = {
    superchargers: (data.response.superchargers ?? []).map(toSite),
    destinations: (data.response.destination_charging ?? []).map(toSite),
  };
  sitesCache.set(userId, { sites, at: Date.now() });
  return { ...sites, asleep: false };
}

export interface TeslaChargingSession {
  id: string;
  site: string | null;
  startedAt: string | null;
  endedAt: string | null;
  energyKwh: number | null;
  totalDue: number | null;
  currency: string | null;
  fees: Array<{ type: string; usage: number | null; unit: string | null; total: number | null }>;
}

const HistorySchema = z.looseObject({
  data: z
    .array(
      z.looseObject({
        sessionId: z.union([z.string(), z.number()]).optional(),
        siteLocationName: z.string().nullable().optional(),
        chargeStartDateTime: z.string().nullable().optional(),
        chargeStopDateTime: z.string().nullable().optional(),
        fees: z
          .array(
            z.looseObject({
              feeType: z.string().nullable().optional(),
              usageBase: z.number().nullable().optional(),
              uom: z.string().nullable().optional(),
              totalDue: z.number().nullable().optional(),
              currencyCode: z.string().nullable().optional(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .optional(),
  totalResults: z.number().optional(),
});

const historyCache = new Map<string, { sessions: TeslaChargingSession[]; at: number }>();
const HISTORY_TTL_MS = 30 * 60_000;

/** Historial de carga facturado por Tesla (Supercargadores) para el VIN del vehículo. */
export async function getTeslaChargingHistory(userId: string): Promise<TeslaChargingSession[]> {
  const cached = historyCache.get(userId);
  if (cached && Date.now() - cached.at < HISTORY_TTL_MS) return cached.sessions;
  const { entry } = await fetchVehicleRaw(userId, false);
  const vin = entry.vehicle.vin;
  if (!vin) throw new TeslaError("TESLA_NO_VIN", "Tesla no devolvió el VIN del vehículo.", 404);
  const { data } = await teslaFetch(userId, `/api/1/dx/charging/history?vin=${encodeURIComponent(vin)}&pageSize=12&sortBy=chargeStartDateTime&sortOrder=DESC`, {}, HistorySchema);
  const sessions: TeslaChargingSession[] = (data?.data ?? []).map((session, index) => {
    const fees = (session.fees ?? []).map((fee) => ({ type: fee.feeType ?? "FEE", usage: fee.usageBase ?? null, unit: fee.uom ?? null, total: fee.totalDue ?? null }));
    const charging = fees.find((fee) => fee.type.toUpperCase() === "CHARGING");
    return {
      id: String(session.sessionId ?? index),
      site: session.siteLocationName ?? null,
      startedAt: session.chargeStartDateTime ?? null,
      endedAt: session.chargeStopDateTime ?? null,
      energyKwh: charging?.usage ?? null,
      totalDue: fees.reduce<number | null>((sum, fee) => (fee.total === null ? sum : (sum ?? 0) + fee.total), null),
      currency: session.fees?.find((fee) => fee.currencyCode)?.currencyCode ?? null,
      fees,
    };
  });
  historyCache.set(userId, { sessions, at: Date.now() });
  return sessions;
}

/** Pide al vehículo que despierte. Tesla responde enseguida; el auto tarda unos segundos. */
export async function wakeTeslaVehicle(userId: string): Promise<{ state: string | null }> {
  const vehicles = await listTeslaVehicles(userId);
  const vehicle = vehicles[0];
  if (!vehicle) throw new TeslaError("TESLA_NO_VEHICLE", "Tu cuenta de Tesla no tiene vehículos asociados.", 404);
  const { data } = await teslaFetch(userId, `/api/1/vehicles/${encodeURIComponent(vehicle.id)}/wake_up`, { method: "POST" }, z.looseObject({ response: z.looseObject({ state: z.string().nullable().optional() }).optional() }));
  snapshotCache.delete(userId);
  sitesCache.delete(userId);
  vehiclesCache.delete(userId);
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
