import { describe, expect, it } from "vitest";
import {
  TESLA_DEFAULT_SCOPES,
  asleepSnapshot,
  normalizeChargingState,
  normalizeVehicleData,
  subjectFromJwt,
  teslaFleetBase,
  teslaScopes,
} from "@/lib/integrations/tesla";
import { chargingLabel } from "@/features/tesla/hooks";

const vehicle = { id: "123", vin: "5YJ3E1EA7KF000000", name: "Rayo", state: "online" };

describe("Tesla Fleet API", () => {
  it("asks only for the read scopes by default and dedupes extras", () => {
    expect(teslaScopes("")).toBe(TESLA_DEFAULT_SCOPES.join(" "));
    expect(teslaScopes("vehicle_cmds, vehicle_device_data")).toContain("vehicle_cmds");
    expect(teslaScopes("vehicle_cmds").split(" ").filter((scope) => scope === "vehicle_device_data")).toHaveLength(1);
    expect(teslaScopes("")).not.toContain("vehicle_cmds");
  });

  it("targets the regional fleet endpoint", () => {
    expect(teslaFleetBase("na")).toBe("https://fleet-api.prd.na.vn.cloud.tesla.com");
    expect(teslaFleetBase("eu")).toBe("https://fleet-api.prd.eu.vn.cloud.tesla.com");
  });

  it("reads the subject from an unsigned JWT payload without trusting it for auth", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "abc-123" })).toString("base64url");
    expect(subjectFromJwt(`x.${payload}.y`)).toBe("abc-123");
    expect(subjectFromJwt("garbage")).toBeNull();
  });

  it("normalizes vehicle_data to metric units and stable charging states", () => {
    const snapshot = normalizeVehicleData(
      {
        id_s: "123",
        display_name: "Rayo",
        state: "online",
        charge_state: { battery_level: 64, battery_range: 186.4, charging_state: "Charging", charge_limit_soc: 90, minutes_to_full_charge: 75, charger_power: 11 },
        climate_state: { inside_temp: 31.5, outside_temp: 29, is_climate_on: false, is_preconditioning: true },
        drive_state: { speed: null, shift_state: null, latitude: 9.3, longitude: -75.4 },
        vehicle_state: { locked: true, odometer: 12_000, car_version: "2026.32.1" },
      },
      vehicle,
      new Date("2026-10-27T18:00:00Z"),
    );
    expect(snapshot).toMatchObject({
      vehicleId: "123",
      name: "Rayo",
      asleep: false,
      batteryPercent: 64,
      rangeKm: 300,
      charging: "charging",
      chargeLimitPercent: 90,
      minutesToFull: 75,
      chargerPowerKw: 11,
      pluggedIn: true,
      insideTempC: 31.5,
      climateOn: true,
      locked: true,
      odometerKm: 19_312,
      speedKmh: null,
      location: { latitude: 9.3, longitude: -75.4 },
      softwareVersion: "2026.32.1",
      observedAt: "2026-10-27T18:00:00.000Z",
    });
    expect(chargingLabel(snapshot)).toBe("Cargando · 1 h 15 min para 90%");
  });

  it("derives hours-to-full and hides charger power when not charging", () => {
    const snapshot = normalizeVehicleData(
      { charge_state: { battery_level: 80, charging_state: "Disconnected", time_to_full_charge: 0.5, charger_power: 0 } },
      vehicle,
    );
    expect(snapshot.charging).toBe("disconnected");
    expect(snapshot.pluggedIn).toBe(false);
    expect(snapshot.minutesToFull).toBeNull();
    expect(snapshot.chargerPowerKw).toBeNull();
    expect(chargingLabel(snapshot)).toBe("Desconectado del cargador");
    expect(normalizeChargingState("NoPower")).toBe("no_power");
    expect(normalizeChargingState(undefined)).toBe("unknown");
  });

  it("represents a sleeping car without inventing readings", () => {
    const snapshot = asleepSnapshot({ ...vehicle, state: "asleep" });
    expect(snapshot.asleep).toBe(true);
    expect(snapshot.batteryPercent).toBeNull();
    expect(chargingLabel(snapshot)).toBe("Durmiendo");
  });
});
