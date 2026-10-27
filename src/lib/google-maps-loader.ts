"use client";

/**
 * Carga el Maps JavaScript API de Google una sola vez (bootstrap oficial con
 * `importLibrary`). La clave es la misma del Embed API, restringida por
 * referente en Google Cloud.
 */
let loading: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("GOOGLE_MAPS_SSR"));
  const existing = (window as unknown as { google?: { maps?: typeof google.maps } }).google;
  if (existing?.maps?.importLibrary) return Promise.resolve(existing.maps);
  if (loading) return loading;
  loading = new Promise<typeof google.maps>((resolve, reject) => {
    const params = new URLSearchParams({ key, v: "weekly", language: "es", region: "CO", loading: "async", libraries: "maps,marker,geometry" });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("GOOGLE_MAPS_LOAD_FAILED"));
    };
    script.onload = () => {
      const loaded = (window as unknown as { google?: { maps?: typeof google.maps } }).google;
      if (loaded?.maps) resolve(loaded.maps);
      else reject(new Error("GOOGLE_MAPS_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
