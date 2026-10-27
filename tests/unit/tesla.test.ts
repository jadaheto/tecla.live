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

describe("Tesla detail", () => {
  it("normalizes config, doors, tyres, software and units for the Mi Tesla page", async () => {
    const { normalizeVehicleDetail, teslaModelName } = await import("@/lib/integrations/tesla");
    const detail = normalizeVehicleDetail(
      {
        vin: "5YJ3E1EA7KF000000",
        display_name: "Rayo",
        state: "online",
        charge_state: { battery_level: 64, usable_battery_level: 63, battery_range: 186.4, charging_state: "Charging", charger_voltage: 240, charger_actual_current: 32, charge_energy_added: 12.5, charge_miles_added_rated: 50, charge_port_latch: "Engaged", scheduled_charging_start_time: 23 * 60 + 30 },
        climate_state: { inside_temp: 31, driver_temp_setting: 21, passenger_temp_setting: 22, fan_status: 3, seat_heater_left: 2 },
        drive_state: { heading: 92, power: -5, gps_as_of: 1_761_600_000 },
        vehicle_state: { locked: false, df: 1, pf: 0, dr: 0, pr: 0, ft: 0, rt: 1, fd_window: 0, fp_window: 1, rd_window: 0, rp_window: 0, tpms_pressure_fl: 2.9, tpms_pressure_fr: 2.4, tpms_soft_warning_fr: true, car_version: "2026.32.1 abc123", software_update: { status: "available", version: "2026.36.2", download_perc: 40, expected_duration_sec: 1500 } },
        vehicle_config: { car_type: "model3", trim_badging: "74d", exterior_color: "DeepBlue", wheel_type: "Pinwheel18", rhd: false, eu_vehicle: false },
        gui_settings: { gui_distance_units: "km/hr", gui_temperature_units: "C", gui_24_hour_time: true },
      },
      vehicle,
    );
    expect(detail.identity).toMatchObject({ model: "Model 3", trim: "74d", exteriorColor: "DeepBlue", wheels: "Pinwheel18", euVehicle: false });
    expect(detail.charge).toMatchObject({ usablePercent: 63, voltage: 240, currentA: 32, energyAddedKwh: 12.5, rangeAddedKm: 80, portLatch: "Engaged", scheduledStartMinutes: 1_410 });
    expect(detail.climate).toMatchObject({ driverSetC: 21, passengerSetC: 22, fan: 3 });
    expect(detail.climate.seatHeaters.frontLeft).toBe(2);
    expect(detail.body.doors).toEqual({ frontLeft: true, frontRight: false, rearLeft: false, rearRight: false });
    expect(detail.body.trunks).toEqual({ front: false, rear: true });
    expect(detail.body.windows.frontRight).toBe(true);
    expect(detail.tyres).toMatchObject({ frontLeftBar: 2.9, frontRightBar: 2.4, rearLeftBar: null });
    expect(detail.tyres.warnings.frontRight).toBe(true);
    expect(detail.drive).toMatchObject({ heading: 92, powerKw: -5, gpsAt: "2025-10-27T21:20:00.000Z" });
    expect(detail.software).toMatchObject({ version: "2026.32.1 abc123", updateStatus: "available", updateVersion: "2026.36.2", downloadPercent: 40, expectedMinutes: 25 });
    expect(detail.units).toMatchObject({ distance: "km/hr", temperature: "C", time24h: true });
    expect(detail.summary.batteryPercent).toBe(64);
    expect(teslaModelName("modely")).toBe("Model Y");
    expect(teslaModelName("tamarind")).toBe("Model X");
    expect(teslaModelName(null)).toBeNull();
  });
});
