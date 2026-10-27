"use client";

/**
 * Carga el Maps JavaScript API de Google una sola vez. Con `loading=async`
 * la API avisa que está lista llamando al `callback`; solo entonces existe
 * `google.maps.importLibrary`. La clave es la misma del Embed API,
 * restringida por referente en Google Cloud.
 */
type GoogleWindow = Window & { google?: { maps?: typeof google.maps }; __teclaMapsReady?: () => void };

let loading: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("GOOGLE_MAPS_SSR"));
  const win = window as GoogleWindow;
  if (typeof win.google?.maps?.importLibrary === "function") return Promise.resolve(win.google.maps);
  if (loading) return loading;
  loading = new Promise<typeof google.maps>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      loading = null;
      reject(new Error("Google Maps tardó demasiado en cargar"));
    }, 20_000);
    win.__teclaMapsReady = () => {
      window.clearTimeout(timeout);
      const maps = (window as GoogleWindow).google?.maps;
      if (maps && typeof maps.importLibrary === "function") resolve(maps);
      else {
        loading = null;
        reject(new Error("Google Maps no expuso importLibrary"));
      }
    };
    const params = new URLSearchParams({ key, v: "weekly", language: "es", region: "CO", loading: "async", libraries: "maps,marker,geometry", callback: "__teclaMapsReady" });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      loading = null;
      reject(new Error("No se pudo descargar el script de Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
