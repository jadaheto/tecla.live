"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleDot,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitFork,
  LocateFixed,
  Merge,
  Navigation,
  RotateCcw,
  Ship,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { announce } from "@/features/ai/announce";
import {
  announcementText,
  bearingDeg,
  formatDuration,
  formatEta,
  formatMeters,
  humanizeManeuverFallback,
  locateOnRoute,
  maneuverIcon,
  nextAnnouncement,
  OFF_ROUTE_FIXES,
  offRouteCounter,
  type AnnounceStage,
  type GuidanceRoute,
  type LatLng,
  type ManeuverIcon,
} from "@/features/navigation/guidance";
import { computeGuidanceRoute, type RoutePlace } from "@/features/navigation/routes-api";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

const ICONS: Record<ManeuverIcon, typeof ArrowUp> = {
  left: CornerUpLeft,
  right: CornerUpRight,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  "sharp-left": CornerUpLeft,
  "sharp-right": CornerUpRight,
  uturn: RotateCcw,
  straight: ArrowUp,
  roundabout: CircleDot,
  merge: Merge,
  fork: GitFork,
  ramp: ArrowUpRight,
  ferry: Ship,
  depart: Navigation,
  arrive: Flag,
};

const REROUTE_MIN_MS = 30_000;
const ARRIVE_M = 30;

interface Fix {
  point: LatLng;
  heading: number | null;
  speedKmh: number | null;
}

/**
 * Modo navegación dentro de TECLA, al estilo de un navegador: mapa
 * vectorial de Google inclinado que gira con el rumbo y sigue al auto,
 * próxima maniobra en grande, llegada estimada, tráfico, recálculo al
 * desviarse y voz opcional de TECLA. Solo lectura del GPS del navegador.
 */
export function NavigationMode({
  apiKey,
  mapId,
  origin,
  destination,
  destinationLabel,
  onExit,
}: {
  apiKey: string;
  mapId: string;
  origin: LatLng | null;
  destination: RoutePlace;
  destinationLabel: string;
  onExit: () => void;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const routeLineRef = React.useRef<google.maps.Polyline | null>(null);
  const carRef = React.useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const trafficRef = React.useRef<google.maps.TrafficLayer | null>(null);
  const navVoice = usePreferences((state) => state.navVoice);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const [status, setStatus] = React.useState<"loading" | "routing" | "guiding" | "arrived" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [route, setRoute] = React.useState<GuidanceRoute | null>(null);
  const [fix, setFix] = React.useState<Fix | null>(origin ? { point: origin, heading: null, speedKmh: null } : null);
  const [following, setFollowing] = React.useState(true);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [metrics, setMetrics] = React.useState<{ toManeuverM: number; remainingM: number; remainingS: number } | null>(null);
  const offRouteRef = React.useRef(0);
  const lastRerouteRef = React.useRef(0);
  const announcedRef = React.useRef<{ step: number; stages: Set<AnnounceStage> }>({ step: -1, stages: new Set() });
  const headingRef = React.useRef<number>(0);
  const lastPointRef = React.useRef<LatLng | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const requestRouteRef = React.useRef<(from: LatLng) => Promise<void>>(async () => undefined);
  const startedRef = React.useRef(false);
  const mountedAtRef = React.useRef(0);
  /** Guía por fix: la llama el callback del GPS (sistema externo), con el estado más reciente. */
  const guideRef = React.useRef<(next: Fix) => void>(() => undefined);

  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // 1) Mapa (cuando el contenedor del portal ya existe).
  React.useEffect(() => {
    if (!portalTarget) return;
    let disposed = false;
    void loadGoogleMaps(apiKey)
      .then(async (maps) => {
        // Con `loading=async` las clases solo existen tras importar sus bibliotecas.
        const [mapsLibrary, markerLibrary] = await Promise.all([
          maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        ]);
        if (disposed) return;
        const host = hostRef.current;
        if (!host) throw new Error("Contenedor del mapa no disponible");
        const center = origin ?? lastPointRef.current ?? { lat: 4.65, lng: -74.08 };
        const map = new mapsLibrary.Map(host, {
          mapId,
          center,
          zoom: 17,
          tilt: 60,
          heading: 0,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          keyboardShortcuts: false,
        });
        trafficRef.current = new mapsLibrary.TrafficLayer();
        trafficRef.current.setMap(map);
        const arrow = document.createElement("div");
        arrow.className = "nav-car";
        arrow.innerHTML = '<span class="nav-car__arrow"></span><span class="nav-car__halo"></span>';
        carRef.current = new markerLibrary.AdvancedMarkerElement({ map, position: center, content: arrow, zIndex: 1_000 });
        map.addListener("dragstart", () => setFollowing(false));
        mapRef.current = map;
        setStatus((current) => (current === "loading" ? "routing" : current));
        if (!startedRef.current && lastPointRef.current) {
          startedRef.current = true;
          void requestRouteRef.current(lastPointRef.current);
        }
      })
      .catch((caught: unknown) => {
        const detail = caught instanceof Error ? caught.message : String(caught);
        setError(`No pudimos cargar el mapa de Google (${detail}). Revisa la clave y que Maps JavaScript API esté habilitada.`);
        setStatus("error");
      });
    return () => {
      disposed = true;
      routeLineRef.current?.setMap(null);
      trafficRef.current?.setMap(null);
      if (carRef.current) carRef.current.map = null;
      mapRef.current = null;
    };
    // El mapa se crea una vez por sesión de navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapId, portalTarget]);

  // 2) GPS del navegador.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Este navegador no ofrece GPS.");
      setStatus("error");
      return;
    }
    mountedAtRef.current = Date.now();
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const speedKmh = typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed) ? position.coords.speed * 3.6 : null;
        let heading = typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading) ? position.coords.heading : null;
        if (heading === null && lastPointRef.current && (speedKmh === null || speedKmh > 3)) {
          const moved = Math.abs(point.lat - lastPointRef.current.lat) + Math.abs(point.lng - lastPointRef.current.lng);
          if (moved > 0.00005) heading = bearingDeg(lastPointRef.current, point);
        }
        lastPointRef.current = point;
        const next = { point, heading, speedKmh };
        setFix(next);
        guideRef.current(next);
      },
      (failure) => {
        // Pérdidas momentáneas (código 2 o 3) con fixes previos no son fatales; solo el permiso negado
        // o la falta total de señal en 20 s detienen la navegación.
        if (failure.code !== 1 && lastPointRef.current) return;
        if (failure.code !== 1 && Date.now() - mountedAtRef.current < 20_000) return;
        setError(failure.code === 1 ? "El navegador bloqueó la ubicación. Permítela para navegar." : "No hay señal GPS. Prueba al aire libre.");
        setStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 15_000 },
    );
    void navigator.wakeLock?.request("screen").then((lock) => {
      wakeLockRef.current = lock;
    }).catch(() => undefined);
    return () => {
      navigator.geolocation.clearWatch(watch);
      void wakeLockRef.current?.release().catch(() => undefined);
    };
  }, []);

  // 3) Ruta (al empezar y en cada desvío confirmado).
  const requestRoute = React.useCallback(
    async (from: LatLng) => {
      setStatus("routing");
      try {
        const computed = await computeGuidanceRoute({ key: apiKey, origin: from, destination });
        setRoute(computed);
        setStepIndex(0);
        announcedRef.current = { step: -1, stages: new Set() };
        offRouteRef.current = 0;
        setStatus("guiding");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No pudimos calcular la ruta.");
        setStatus("error");
      }
    },
    [apiKey, destination],
  );

  React.useEffect(() => {
    requestRouteRef.current = requestRoute;
  }, [requestRoute]);

  // Dibuja la ruta (contorno oscuro + línea cian) y muestra el trayecto completo dos segundos.
  const outlineRef = React.useRef<google.maps.Polyline | null>(null);
  const overviewUntilRef = React.useRef(0);
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;
    routeLineRef.current?.setMap(null);
    outlineRef.current?.setMap(null);
    outlineRef.current = new google.maps.Polyline({ path: route.path, strokeColor: "#062a3f", strokeOpacity: 0.9, strokeWeight: 12, zIndex: 50, map });
    routeLineRef.current = new google.maps.Polyline({ path: route.path, strokeColor: "#4cc9ff", strokeOpacity: 1, strokeWeight: 7, zIndex: 51, map });
    if (route.path.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      for (const point of route.path) bounds.extend(point);
      map.moveCamera({ tilt: 0, heading: 0 });
      map.fitBounds(bounds, { top: 180, bottom: 140, left: 80, right: 80 });
      overviewUntilRef.current = Date.now() + 2_500;
    }
    return () => {
      outlineRef.current?.setMap(null);
    };
  }, [route]);

  // 4) Guía: con cada fix, posición sobre la ruta, cámara, avisos y desvío.
  const guide = (next: Fix) => {
    const map = mapRef.current;
    if (carRef.current) carRef.current.position = next.point;
    if (next.heading !== null) headingRef.current = next.heading;
    if (map && following && Date.now() > overviewUntilRef.current) {
      map.moveCamera({ center: next.point, heading: headingRef.current, tilt: 60, zoom: next.speedKmh !== null && next.speedKmh > 70 ? 16 : 17 });
      // El auto va en el tercio inferior: desplaza la cámara hacia adelante.
      map.panBy(0, -Math.round((hostRef.current?.clientHeight ?? 800) * 0.22));
    }
    if (!startedRef.current && status !== "loading" && status !== "error") {
      startedRef.current = true;
      void requestRoute(next.point);
      return;
    }
    if (!route || status !== "guiding") return;
    const located = locateOnRoute(next.point, route, stepIndex);
    setStepIndex(located.stepIndex);
    setMetrics({ toManeuverM: located.toManeuverM, remainingM: located.remainingM, remainingS: located.remainingS });

    const lastStep = route.steps.length - 1;
    if (located.stepIndex >= lastStep && located.toManeuverM <= ARRIVE_M) {
      setStatus("arrived");
      if (navVoice) void announce("Llegaste a tu destino.", { title: "Navegación" });
      return;
    }

    offRouteRef.current = offRouteCounter(offRouteRef.current, located.offRouteM);
    if (offRouteRef.current >= OFF_ROUTE_FIXES && Date.now() - lastRerouteRef.current > REROUTE_MIN_MS) {
      lastRerouteRef.current = Date.now();
      offRouteRef.current = 0;
      if (navVoice) void announce("Recalculando la ruta.", { title: "Navegación" });
      void requestRoute(next.point);
      return;
    }

    const step = route.steps[located.stepIndex];
    if (!step) return;
    if (announcedRef.current.step !== located.stepIndex) announcedRef.current = { step: located.stepIndex, stages: new Set() };
    const stage = nextAnnouncement(located.toManeuverM, step.distanceM, announcedRef.current.stages);
    if (stage && navVoice) {
      announcedRef.current.stages.add(stage);
      const text = step.instruction || humanizeManeuverFallback(maneuverIcon(step.maneuver));
      void announce(announcementText(stage, text, located.toManeuverM), { title: "Navegación" });
    }
  };
  React.useEffect(() => {
    guideRef.current = guide;
  });

  const current = route?.steps[stepIndex] ?? null;
  const next = route?.steps[stepIndex + 1] ?? null;
  const CurrentIcon = ICONS[maneuverIcon(current?.maneuver)];
  const NextIcon = next ? ICONS[maneuverIcon(next.maneuver)] : null;

  if (!portalTarget) return null;
  return createPortal(
    <div className="nav-mode" role="dialog" aria-label="Navegación">
      <div ref={hostRef} className="nav-mode__map" />

      {/* Maniobra actual */}
      <div className="nav-mode__card nav-mode__card--top">
        {status === "error" ? (
          <div className="p-4">
            <p className="text-sm font-semibold text-red-300">No se pudo iniciar la navegación</p>
            <p className="mt-1 text-[12px] text-white/70">{error}</p>
          </div>
        ) : status === "loading" || status === "routing" || !current ? (
          <div className="flex items-center gap-3 p-4">
            <span className="nav-mode__spinner" aria-hidden />
            <p className="text-sm font-medium">{status === "loading" ? "Cargando el mapa…" : fix ? "Calculando la ruta…" : "Esperando señal GPS…"}</p>
          </div>
        ) : status === "arrived" ? (
          <div className="flex items-center gap-3 p-4">
            <Flag className="size-7 text-emerald-300" aria-hidden />
            <div>
              <p className="text-lg font-semibold">Llegaste</p>
              <p className="text-[12px] text-white/70">{destinationLabel}</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-4 p-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0b1a2a]">
                <CurrentIcon className="size-9" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-display text-[2.2rem] leading-none tabular-nums">{metrics ? formatMeters(metrics.toManeuverM) : "—"}</p>
                <p className="mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug">{current.instruction || humanizeManeuverFallback(maneuverIcon(current.maneuver))}</p>
              </div>
            </div>
            {next && NextIcon ? (
              <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-[12px] text-white/70">
                <span className="text-white/50">Luego</span>
                <NextIcon className="size-4" aria-hidden />
                <span className="line-clamp-1">{next.instruction || humanizeManeuverFallback(maneuverIcon(next.maneuver))}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Barra inferior */}
      <div className="nav-mode__card nav-mode__card--bottom">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Llegada</p>
          <p className="text-2xl font-semibold tabular-nums leading-none">{metrics ? formatEta(metrics.remainingS) : "--:--"}</p>
          <p className="mt-1 truncate text-[12px] text-white/70">
            {metrics ? `${formatDuration(metrics.remainingS)} · ${formatMeters(metrics.remainingM)}` : destinationLabel}
            {fix?.speedKmh !== null && fix?.speedKmh !== undefined ? ` · ${Math.round(fix.speedKmh)} km/h` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!following ? (
            <button type="button" onClick={() => setFollowing(true)} className="nav-mode__button" aria-label="Volver a seguir el auto">
              <LocateFixed className="size-5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPreferences({ navVoice: !navVoice })}
            className={cn("nav-mode__button", navVoice && "is-active")}
            aria-pressed={navVoice}
            aria-label={navVoice ? "Silenciar la voz" : "Activar la voz"}
          >
            {navVoice ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
          </button>
          <button type="button" onClick={onExit} className="nav-mode__button nav-mode__button--exit" aria-label="Salir de la navegación">
            <X className="size-5" aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {!reduceMotion ? null : <span className="sr-only">Animaciones reducidas</span>}
      <p className="nav-mode__attribution">Mapa, tráfico y rutas: Google. No manipules la pantalla mientras conduces.</p>
    </div>,
    portalTarget,
  );
}
