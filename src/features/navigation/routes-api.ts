"use client";

import { decodePolyline, type GuidanceRoute, type LatLng } from "@/features/navigation/guidance";

/**
 * Routes API de Google (computeRoutes) desde el navegador con la clave
 * restringida por referente. Una llamada por viaje y otra por desvío
 * confirmado; el campo de máscara limita la respuesta a lo que la guía usa.
 */
export type RoutePlace = LatLng | string;

interface RoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{
      steps?: Array<{
        distanceMeters?: number;
        staticDuration?: string;
        polyline?: { encodedPolyline?: string };
        navigationInstruction?: { maneuver?: string; instructions?: string };
      }>;
    }>;
  }>;
  error?: { message?: string; status?: string };
}

function seconds(value: string | undefined): number {
  const parsed = Number.parseFloat((value ?? "0").replace("s", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function waypoint(place: RoutePlace): Record<string, unknown> {
  return typeof place === "string" ? { address: place } : { location: { latLng: { latitude: place.lat, longitude: place.lng } } };
}

export async function computeGuidanceRoute(input: { key: string; origin: RoutePlace; destination: RoutePlace; signal?: AbortSignal }): Promise<GuidanceRoute> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": input.key,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.navigationInstruction",
    },
    body: JSON.stringify({
      origin: waypoint(input.origin),
      destination: waypoint(input.destination),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "es-CO",
      regionCode: "CO",
      units: "METRIC",
      computeAlternativeRoutes: false,
    }),
    signal: input.signal,
  });
  const json = (await response.json().catch(() => null)) as RoutesResponse | null;
  if (!response.ok || !json?.routes?.[0]) {
    const detail = json?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`No pudimos calcular la ruta (${detail}).`);
  }
  const best = json.routes[0];
  const steps = (best.legs ?? []).flatMap((leg) => leg.steps ?? []).map((step) => ({
    instruction: step.navigationInstruction?.instructions?.trim() || "",
    maneuver: step.navigationInstruction?.maneuver ?? "",
    distanceM: step.distanceMeters ?? 0,
    durationS: seconds(step.staticDuration),
    path: decodePolyline(step.polyline?.encodedPolyline ?? ""),
  }));
  return {
    distanceM: best.distanceMeters ?? steps.reduce((sum, step) => sum + step.distanceM, 0),
    durationS: seconds(best.duration) || steps.reduce((sum, step) => sum + step.durationS, 0),
    path: decodePolyline(best.polyline?.encodedPolyline ?? ""),
    steps,
  };
}
