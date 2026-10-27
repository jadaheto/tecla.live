import type { TeslaSnapshot } from "@/lib/integrations/tesla";
import type { EffectivePersona } from "@/features/ai/persona";

/**
 * Reglas puras del Tesla en vivo: estacionado o en marcha, modo carga
 * automático y avisos por voz. Nada de esto consulta la API: recibe las
 * lecturas que ya tiene el cliente.
 */
export function isParked(snapshot: TeslaSnapshot | null): boolean | null {
  if (!snapshot || snapshot.asleep) return null;
  if (snapshot.speedKmh !== null && snapshot.speedKmh > 0) return false;
  const shift = (snapshot.shiftState ?? "P").toUpperCase();
  return shift === "P" || shift === "";
}

export interface ChargeModeInput {
  enabled: boolean;
  snapshot: TeslaSnapshot | null;
  ambientOpen: boolean;
  /** La Pantalla ambiente se abrió por la carga (no por el usuario). */
  openedByCharge: boolean;
  /** El usuario la cerró con un toque durante esta misma carga: no se insiste. */
  dismissed?: boolean;
  videoOnScreen: boolean;
  assistantOpen: boolean;
  pathname: string;
}

export type ChargeModeDecision = "open" | "close" | "keep" | "dismiss";

/**
 * Abre la Pantalla ambiente cuando empieza la carga y la cierra cuando termina
 * o el auto arranca. Si el usuario la cerró con un toque, `dismiss`: no se
 * vuelve a abrir hasta la próxima carga.
 */
export function chargeModeDecision(input: ChargeModeInput): ChargeModeDecision {
  const charging = input.snapshot?.charging === "charging";
  if (input.openedByCharge) {
    if (!input.ambientOpen) return "dismiss";
    if (!input.enabled || !charging || isParked(input.snapshot) === false) return "close";
    return "keep";
  }
  if (!input.enabled || !charging || input.ambientOpen || input.dismissed) return "keep";
  if (input.videoOnScreen || input.assistantOpen) return "keep";
  if (input.pathname.startsWith("/drive") || input.pathname.startsWith("/watch") || input.pathname.startsWith("/remote")) return "keep";
  return "open";
}

export interface TeslaAlert {
  id: "low_battery" | "charge_started" | "charge_complete" | "unlocked";
  text: string;
}

export interface AlertInput {
  previous: TeslaSnapshot | null;
  current: TeslaSnapshot;
  persona: EffectivePersona;
  lowBatteryPercent: number;
  /** Avisos ya dados en esta sesión (los de una sola vez no se repiten). */
  announced: ReadonlySet<string>;
}

function address(persona: EffectivePersona): string {
  return persona === "piloto" ? ", piloto" : persona === "copiloto" ? "" : ", señor";
}

function minutesText(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "";
  if (minutes >= 60) return `${Math.floor(minutes / 60)} horas y ${minutes % 60} minutos`;
  return `${minutes} minutos`;
}

/** Avisos a pronunciar tras una lectura nueva. Cada tipo se decide con la transición anterior → actual. */
export function teslaAlerts(input: AlertInput): TeslaAlert[] {
  const { previous, current, persona, lowBatteryPercent, announced } = input;
  if (current.asleep) return [];
  const alerts: TeslaAlert[] = [];
  const suffix = address(persona);
  const charging = current.charging === "charging";
  const wasCharging = previous?.charging === "charging";

  if (
    !announced.has("low_battery") &&
    current.batteryPercent !== null &&
    current.batteryPercent <= lowBatteryPercent &&
    !charging
  ) {
    const range = current.rangeKm !== null ? `, unos ${current.rangeKm} kilómetros de autonomía` : "";
    alerts.push({
      id: "low_battery",
      text: persona === "copiloto"
        ? `Ojo: batería al ${current.batteryPercent} %${range}. Conviene cargar pronto.`
        : `Batería al ${current.batteryPercent} %${range}. Recomiendo cargar pronto${suffix}.`,
    });
  }

  if (previous && !wasCharging && charging) {
    const power = current.chargerPowerKw ? ` a ${current.chargerPowerKw} kilovatios` : "";
    const eta = minutesText(current.minutesToFull);
    const limit = current.chargeLimitPercent ?? 100;
    alerts.push({
      id: "charge_started",
      text: `Carga iniciada${power}${eta ? `; ${eta} para llegar al ${limit} %` : ""}${suffix}.`,
    });
  }

  if (previous && wasCharging && current.charging === "complete") {
    const range = current.rangeKm !== null ? `, ${current.rangeKm} kilómetros disponibles` : "";
    alerts.push({
      id: "charge_complete",
      text: `Carga completa: ${current.batteryPercent ?? "100"} %${range}${suffix}.`,
    });
  }

  if (
    !announced.has("unlocked") &&
    current.locked === false &&
    current.userPresent === false &&
    isParked(current) === true &&
    !charging
  ) {
    alerts.push({
      id: "unlocked",
      text: persona === "copiloto" ? "El auto quedó sin bloquear." : `El vehículo quedó sin bloquear${suffix}.`,
    });
  }

  return alerts;
}
