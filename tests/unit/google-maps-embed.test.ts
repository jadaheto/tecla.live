import { describe, expect, it } from "vitest";
import { buildGoogleMapsEmbedDirectionsUrl, buildGoogleMapsEmbedPlaceUrl, metersBetween } from "@/lib/integrations/google-maps-embed";

describe("Google Maps Embed (ruta dentro de TECLA)", () => {
  it("builds a driving directions embed in Spanish for Colombia", () => {
    const url = new URL(buildGoogleMapsEmbedDirectionsUrl({ key: "k", origin: { latitude: 4.6533, longitude: -74.0836 }, destination: "Terpel Autopista Norte, Bogotá" }));
    expect(`${url.origin}${url.pathname}`).toBe("https://www.google.com/maps/embed/v1/directions");
    expect(url.searchParams.get("origin")).toBe("4.65330,-74.08360");
    expect(url.searchParams.get("destination")).toBe("Terpel Autopista Norte, Bogotá");
    expect(url.searchParams.get("mode")).toBe("driving");
    expect(url.searchParams.get("language")).toBe("es");
    expect(url.searchParams.get("region")).toBe("co");
    expect(url.searchParams.get("avoid")).toBeNull();
    expect(buildGoogleMapsEmbedDirectionsUrl({ key: "k", origin: "A", destination: "B", avoid: ["tolls", "ferries"] })).toContain("avoid=tolls%7Cferries");
  });

  it("falls back to a place embed when there is no origin yet", () => {
    const url = new URL(buildGoogleMapsEmbedPlaceUrl({ key: "k", place: { latitude: 4.7625, longitude: -74.046 } }));
    expect(url.pathname).toBe("/maps/embed/v1/place");
    expect(url.searchParams.get("q")).toBe("4.76250,-74.04600");
  });

  it("measures distance to decide when to redraw the route", () => {
    const a = { latitude: 4.6533, longitude: -74.0836 };
    expect(metersBetween(a, a)).toBe(0);
    expect(Math.round(metersBetween(a, { latitude: 4.6633, longitude: -74.0836 }))).toBeGreaterThan(1_050);
    expect(Math.round(metersBetween(a, { latitude: 4.6633, longitude: -74.0836 }))).toBeLessThan(1_150);
  });
});
