import { describe, expect, it } from "vitest";
import { asleepSnapshot, type TeslaSnapshot } from "@/lib/integrations/tesla";
import { chargeModeDecision, isParked, teslaAlerts } from "@/features/tesla/alerts";

function snap(overrides: Partial<TeslaSnapshot> = {}): TeslaSnapshot {
  return {
    vehicleId: "1",
    vin: null,
    name: "Rayo",
    state: "online",
    asleep: false,
    batteryPercent: 55,
    rangeKm: 240,
    charging: "disconnected",
    chargeLimitPercent: 90,
    minutesToFull: null,
    chargerPowerKw: null,
    pluggedIn: false,
    insideTempC: 28,
    outsideTempC: 30,
    climateOn: false,
    locked: true,
    odometerKm: 1000,
    speedKmh: null,
    shiftState: null,
    location: null,
    softwareVersion: null,
    sentryMode: null,
    userPresent: true,
    observedAt: "2026-10-27T18:00:00.000Z",
    cached: false,
    ...overrides,
  };
}

describe("Tesla en vivo: estacionado", () => {
  it("reads park state from gear and speed", () => {
    expect(isParked(null)).toBeNull();
    expect(isParked(asleepSnapshot({ id: "1", vin: null, name: null, state: "asleep" }))).toBeNull();
    expect(isParked(snap())).toBe(true);
    expect(isParked(snap({ shiftState: "P" }))).toBe(true);
    expect(isParked(snap({ shiftState: "D" }))).toBe(false);
    expect(isParked(snap({ shiftState: null, speedKmh: 40 }))).toBe(false);
  });
});

describe("modo carga automático", () => {
  const base = { enabled: true, ambientOpen: false, openedByCharge: false, videoOnScreen: false, assistantOpen: false, pathname: "/" };

  it("opens the ambient screen when charging starts and closes it when it ends or the car moves", () => {
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "charging" }) })).toBe("open");
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "charging" }), ambientOpen: true, openedByCharge: true })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "complete" }), ambientOpen: true, openedByCharge: true })).toBe("close");
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "charging", shiftState: "D" }), ambientOpen: true, openedByCharge: true })).toBe("close");
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "charging" }), ambientOpen: true, openedByCharge: true, enabled: false })).toBe("close");
  });

  it("never covers a video, the assistant, Drive or a user-opened ambient screen", () => {
    const charging = snap({ charging: "charging" });
    expect(chargeModeDecision({ ...base, snapshot: charging, videoOnScreen: true })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: charging, assistantOpen: true })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: charging, pathname: "/drive" })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: charging, ambientOpen: true, openedByCharge: false })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: snap({ charging: "complete" }), ambientOpen: true, openedByCharge: false })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: null })).toBe("keep");
    expect(chargeModeDecision({ ...base, snapshot: charging, enabled: false })).toBe("keep");
    // Cerrada por el usuario durante esta carga: se marca y no se insiste.
    expect(chargeModeDecision({ ...base, snapshot: charging, ambientOpen: false, openedByCharge: true })).toBe("dismiss");
    expect(chargeModeDecision({ ...base, snapshot: charging, dismissed: true })).toBe("keep");
  });
});

describe("avisos por voz", () => {
  const common = { persona: "jarvis" as const, lowBatteryPercent: 20, announced: new Set<string>() };

  it("warns once about low battery, with range, in the persona's voice", () => {
    const alerts = teslaAlerts({ ...common, previous: null, current: snap({ batteryPercent: 15, rangeKm: 70 }) });
    expect(alerts.map((alert) => alert.id)).toEqual(["low_battery"]);
    expect(alerts[0]?.text).toBe("Batería al 15 %, unos 70 kilómetros de autonomía. Recomiendo cargar pronto, señor.");
    expect(teslaAlerts({ ...common, announced: new Set(["low_battery"]), previous: null, current: snap({ batteryPercent: 15 }) })).toEqual([]);
    expect(teslaAlerts({ ...common, previous: null, current: snap({ batteryPercent: 15, charging: "charging" }) })).toEqual([]);
    expect(teslaAlerts({ ...common, persona: "copiloto", previous: null, current: snap({ batteryPercent: 10, rangeKm: null }) })[0]?.text).toBe("Ojo: batería al 10 %. Conviene cargar pronto.");
    expect(teslaAlerts({ ...common, persona: "piloto", previous: null, current: snap({ batteryPercent: 19, rangeKm: null }) })[0]?.text).toContain(", piloto.");
  });

  it("announces charge start and completion on transitions only", () => {
    const idle = snap();
    const charging = snap({ charging: "charging", chargerPowerKw: 11, minutesToFull: 75, chargeLimitPercent: 90 });
    const started = teslaAlerts({ ...common, previous: idle, current: charging });
    expect(started[0]).toEqual({ id: "charge_started", text: "Carga iniciada a 11 kilovatios; 1 horas y 15 minutos para llegar al 90 %, señor." });
    expect(teslaAlerts({ ...common, previous: charging, current: charging })).toEqual([]);
    const complete = teslaAlerts({ ...common, previous: charging, current: snap({ charging: "complete", batteryPercent: 90, rangeKm: 390 }) });
    expect(complete[0]).toEqual({ id: "charge_complete", text: "Carga completa: 90 %, 390 kilómetros disponibles, señor." });
    expect(teslaAlerts({ ...common, previous: null, current: charging })).toEqual([]);
  });

  it("mentions an unlocked car only when parked and empty, and says nothing while asleep", () => {
    const unlocked = snap({ locked: false, userPresent: false });
    expect(teslaAlerts({ ...common, previous: null, current: unlocked }).map((alert) => alert.id)).toEqual(["unlocked"]);
    expect(teslaAlerts({ ...common, previous: null, current: snap({ locked: false, userPresent: true }) })).toEqual([]);
    expect(teslaAlerts({ ...common, previous: null, current: snap({ locked: false, userPresent: false, shiftState: "D" }) })).toEqual([]);
    expect(teslaAlerts({ ...common, previous: null, current: asleepSnapshot({ id: "1", vin: null, name: null, state: "asleep" }) })).toEqual([]);
  });
});
