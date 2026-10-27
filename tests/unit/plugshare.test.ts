import { describe, expect, it } from "vitest";
import { PLUGSHARE_WIDGET_URL, plugShareWidgetUrl, spanForRadiusKm } from "@/features/charging/plugshare";

describe("mapa de PlugShare", () => {
  it("builds the official widget URL centred on the given point", () => {
    const url = new URL(plugShareWidgetUrl({ latitude: 9.3047, longitude: -75.3978 }, 25));
    expect(`${url.origin}${url.pathname}`).toBe(PLUGSHARE_WIDGET_URL);
    expect(url.searchParams.get("latitude")).toBe("9.30470");
    expect(url.searchParams.get("longitude")).toBe("-75.39780");
    expect(Number(url.searchParams.get("spanLat"))).toBeCloseTo(0.45, 2);
    expect(Number(url.searchParams.get("spanLng"))).toBeGreaterThan(0.45);
  });

  it("falls back to the plain widget (browser geolocation) without a centre", () => {
    expect(plugShareWidgetUrl(null)).toBe(PLUGSHARE_WIDGET_URL);
  });

  it("widens the longitude span away from the equator and clamps the radius", () => {
    expect(spanForRadiusKm(25, 0).spanLng).toBeCloseTo(spanForRadiusKm(25, 0).spanLat, 3);
    expect(spanForRadiusKm(25, 60).spanLng).toBeGreaterThan(spanForRadiusKm(25, 60).spanLat * 1.9);
    expect(spanForRadiusKm(1_000, 0).spanLat).toBeCloseTo(600 / 111, 2);
  });
});
