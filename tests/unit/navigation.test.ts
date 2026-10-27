import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsRouteUrl,
  buildNavigateToPlaceHref,
  parsePlaceParams,
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

  it("links Cargadores to Navegar by coordinates and reads them back", () => {
    const href = buildNavigateToPlaceHref("waze", { latitude: 4.7625, longitude: -74.046, label: "Terpel Autopista Norte" }, { latitude: 4.65, longitude: -74.08 });
    expect(href.startsWith("/navigate?")).toBe(true);
    const params = new URLSearchParams(href.slice("/navigate?".length));
    expect(params.get("tab")).toBe("waze");
    expect(params.get("lat")).toBe("4.76250");
    expect(params.get("label")).toBe("Terpel Autopista Norte");
    expect(params.get("from")).toBe("4.65000,-74.08000");
    const parsed = parsePlaceParams(params);
    expect(parsed?.place).toEqual({ latitude: 4.7625, longitude: -74.046, label: "Terpel Autopista Norte" });
    expect(parsed?.from).toEqual({ latitude: 4.65, longitude: -74.08 });
    expect(parsePlaceParams(new URLSearchParams("tab=waze&q=Cartagena"))).toBeNull();
    expect(parsePlaceParams(new URLSearchParams("lat=999&lon=0"))).toBeNull();
  });

  it("builds Google Maps directions with an optional origin", () => {
    expect(buildGoogleMapsDirectionsUrl({ latitude: 4.7625, longitude: -74.046 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=4.7625%2C-74.046&travelmode=driving",
    );
    expect(buildGoogleMapsDirectionsUrl({ latitude: 4.7625, longitude: -74.046 }, { latitude: 4.65, longitude: -74.08 })).toContain("origin=4.65%2C-74.08");
    expect(() => buildGoogleMapsDirectionsUrl({ latitude: 999, longitude: 0 })).toThrow("INVALID_COORDINATES");
  });
});
