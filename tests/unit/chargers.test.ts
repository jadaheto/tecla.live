import { describe, expect, it } from "vitest";
import { normalizeStation, powerTier } from "@/lib/integrations/open-charge-map";
import { thinGeometry } from "@/lib/integrations/routing";

describe("estaciones de carga (Open Charge Map)", () => {
  it("normalizes a POI into a station with connectors and max power", () => {
    const station = normalizeStation({
      ID: 42,
      AddressInfo: { Title: " Parque Comercial ", AddressLine1: "Cra 10 # 20", Town: "Sincelejo", Latitude: 9.3, Longitude: -75.4, Distance: 3.456 },
      OperatorInfo: { Title: "Celsia" },
      StatusType: { IsOperational: true },
      UsageType: { Title: "Public" },
      NumberOfPoints: 2,
      Connections: [
        { ConnectionType: { Title: "CCS (Type 2)" }, PowerKW: 60, Quantity: 1, CurrentType: { Title: "DC" } },
        { ConnectionType: { Title: "Type 2 (Socket Only)" }, PowerKW: 22, Quantity: 1 },
      ],
    });
    expect(station).toMatchObject({ id: "42", name: "Parque Comercial", town: "Sincelejo", operator: "Celsia", distanceKm: 3.5, maxPowerKw: 60, points: 2, operational: true });
    expect(station?.connectors).toHaveLength(2);
    expect(station?.connectors[0]).toMatchObject({ type: "CCS (Type 2)", powerKw: 60, current: "DC" });
    expect(normalizeStation({ ID: 1 })).toBeNull();
  });

  it("classifies charging power", () => {
    expect(powerTier(150)).toBe("fast");
    expect(powerTier(22)).toBe("medium");
    expect(powerTier(7)).toBe("slow");
    expect(powerTier(null)).toBe("unknown");
  });

  it("thins long route geometries while keeping the endpoints", () => {
    const points = Array.from({ length: 2_000 }, (_, i) => [i, i * 2] as [number, number]);
    const thin = thinGeometry(points, 100);
    expect(thin.length).toBeLessThanOrEqual(101);
    expect(thin[0]).toEqual([0, 0]);
    expect(thin[thin.length - 1]).toEqual([1_999, 3_998]);
    expect(thinGeometry(points.slice(0, 10), 100)).toHaveLength(10);
  });
});
