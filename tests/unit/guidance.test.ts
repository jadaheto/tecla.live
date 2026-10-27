import { describe, expect, it } from "vitest";
import {
  announcementText,
  bearingDeg,
  decodePolyline,
  distanceToSegment,
  formatEta,
  formatMeters,
  locateOnRoute,
  maneuverIcon,
  nextAnnouncement,
  offRouteCounter,
  type GuidanceRoute,
} from "@/features/navigation/guidance";

// Ruta de prueba: dos pasos, hacia el norte y luego hacia el este, en Bogotá.
const step1 = [
  { lat: 4.65, lng: -74.08 },
  { lat: 4.655, lng: -74.08 },
  { lat: 4.66, lng: -74.08 },
];
const step2 = [
  { lat: 4.66, lng: -74.08 },
  { lat: 4.66, lng: -74.075 },
  { lat: 4.66, lng: -74.07 },
];
const route: GuidanceRoute = {
  distanceM: 2_216,
  durationS: 300,
  path: [...step1, ...step2],
  steps: [
    { instruction: "Dirígete al norte", maneuver: "DEPART", distanceM: 1_106, durationS: 150, path: step1 },
    { instruction: "Gira a la derecha en Calle 80", maneuver: "TURN_RIGHT", distanceM: 1_110, durationS: 150, path: step2 },
  ],
};

describe("guía de navegación", () => {
  it("decodes Google encoded polylines", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("measures distance to a segment and bearings", () => {
    const result = distanceToSegment({ lat: 4.6525, lng: -74.0805 }, step1[0]!, step1[1]!);
    expect(Math.round(result.distance)).toBeGreaterThan(50);
    expect(Math.round(result.distance)).toBeLessThan(60);
    expect(result.t).toBeCloseTo(0.5, 1);
    expect(Math.round(bearingDeg(step1[0]!, step1[1]!))).toBe(0);
    expect(Math.round(bearingDeg(step2[0]!, step2[1]!))).toBe(90);
  });

  it("locates the car on the route and computes what is left", () => {
    const halfway = locateOnRoute({ lat: 4.6525, lng: -74.08 }, route);
    expect(halfway.stepIndex).toBe(0);
    expect(halfway.offRouteM).toBeLessThan(5);
    expect(halfway.toManeuverM).toBeGreaterThan(800);
    expect(halfway.toManeuverM).toBeLessThan(850);
    expect(halfway.remainingM).toBeGreaterThan(1_900);
    expect(halfway.remainingS).toBeLessThan(300);
    const turning = locateOnRoute({ lat: 4.66, lng: -74.0775 }, route, 0);
    expect(turning.stepIndex).toBe(1);
    // Mitad del primer tramo del paso 2: falta medio tramo (≈277 m) más el segundo (≈555 m).
    expect(turning.toManeuverM).toBeGreaterThan(800);
    expect(turning.toManeuverM).toBeLessThan(860);
  });

  it("confirms a detour only after several far fixes", () => {
    let counter = 0;
    counter = offRouteCounter(counter, 80);
    counter = offRouteCounter(counter, 90);
    expect(counter).toBe(2);
    counter = offRouteCounter(counter, 10);
    expect(counter).toBe(0);
  });

  it("maps maneuvers to icons and formats distances", () => {
    expect(maneuverIcon("TURN_SLIGHT_LEFT")).toBe("slight-left");
    expect(maneuverIcon("ROUNDABOUT_RIGHT")).toBe("roundabout");
    expect(maneuverIcon("UTURN_LEFT")).toBe("uturn");
    expect(maneuverIcon("NAME_CHANGE")).toBe("straight");
    expect(maneuverIcon(undefined)).toBe("straight");
    expect(formatMeters(30)).toBe("ahora");
    expect(formatMeters(342)).toBe("340 m");
    expect(formatMeters(2_450)).toBe("2,5 km");
    expect(formatEta(600, new Date("2026-10-27T20:00:00Z"))).toBe("15:10");
  });

  it("announces far once on long steps and near always", () => {
    const given = new Set<"far" | "near">();
    expect(nextAnnouncement(900, 1_500, given)).toBeNull();
    expect(nextAnnouncement(480, 1_500, given)).toBe("far");
    given.add("far");
    expect(nextAnnouncement(300, 1_500, given)).toBeNull();
    expect(nextAnnouncement(100, 1_500, given)).toBe("near");
    expect(nextAnnouncement(400, 500, new Set())).toBeNull();
    expect(announcementText("far", "Gira a la derecha en Calle 80", 480)).toBe("En 500 m, gira a la derecha en Calle 80");
    expect(announcementText("near", "Gira a la derecha en Calle 80", 90)).toBe("Gira a la derecha en Calle 80");
  });
});
