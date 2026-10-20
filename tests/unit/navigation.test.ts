import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsSearchUrl,
  buildNavigateHref,
  buildWazeRouteUrl,
  buildWazeSearchUrl,
  WAZE_LIVE_MAP_URL,
} from "@/lib/integrations/navigation";

describe("navigation deep links", () => {
  it("encodes Waze destinations", () => {
    const url = buildWazeSearchUrl("Cartagena, Bolívar & playa");
    expect(url).toContain("https://www.waze.com/ul?q=");
    expect(url).toContain(encodeURIComponent("Cartagena, Bolívar & playa"));
    expect(url).toContain("navigate=yes");
  });

  it("builds Google Maps search and route URLs", () => {
    expect(buildGoogleMapsSearchUrl("Sincelejo")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sincelejo",
    );
    expect(buildGoogleMapsRouteUrl("Montería")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Monter%C3%ADa",
    );
  });

  it("validates Waze coordinates", () => {
    expect(buildWazeRouteUrl({ latitude: 9.3047, longitude: -75.3978 })).toContain(
      "ll=9.3047%2C-75.3978",
    );
    expect(() => buildWazeRouteUrl({ latitude: 99, longitude: 0 })).toThrow();
    expect(() => buildWazeRouteUrl({ latitude: Number.NaN, longitude: 0 })).toThrow();
  });

  it("rejects empty destinations", () => {
    expect(() => buildWazeSearchUrl(" ")).toThrow("DESTINATION_TOO_SHORT");
    expect(() => buildGoogleMapsSearchUrl("a")).toThrow("DESTINATION_TOO_SHORT");
  });

  it("points to the official Waze live map for community alerts", () => {
    expect(WAZE_LIVE_MAP_URL).toBe("https://www.waze.com/live-map/");
  });

  it("builds a safe internal navigation href", () => {
    expect(buildNavigateHref("maps", "Bogotá")).toBe(
      `/navigate?tab=maps&q=${encodeURIComponent("Bogotá")}`,
    );
  });
});
