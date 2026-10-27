"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Gauge,
  Maximize2,
  Mic,
  Navigation,
  Play,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Star,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeWeather } from "@/lib/weather-codes";
import { registerMediaController } from "@/features/media/player-bridge";
import { useWeather } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";
import { openAssistant } from "@/features/ai/open-assistant";
import { useDriveStore } from "@/stores/drive";
import { registerDriveController } from "./drive-bridge";
import { DriveCanvas } from "./drive-canvas";
import {
  DRIVE_SCENES,
  ENGINE_CATEGORIES,
  HUD_HIDE_AFTER_SECONDS,
  MAX_SPEED,
  STUDIO_SLIDERS,
  filterEngines,
  findEngine,
  findScene,
  formatSpeed,
  isTeslaBrowser,
  pickAutoScene,
  rpmNorm,
  speedRatio,
  type DriveSceneId,
  type EngineCategory,
  type WeatherGroup,
} from "./drive-config";
import { useDriveGeolocation } from "./drive-geolocation";
import { DriveTelemetry } from "./drive-telemetry";
import { useDriveTelemetry } from "./use-drive-telemetry";
import { describeDriveState } from "./engine-model";
import { useDriveEngine } from "./use-drive-engine";

const GAUGE_PATH = "M 53.64 206.36 A 108 108 0 1 1 206.36 206.36";
const RPM_PATH = "M 72.4 187.6 A 81.5 81.5 0 1 1 187.6 187.6";

function DriveGauge({
  speedKmh,
  rpmRatio,
  useKmh,
  accent,
  label,
  gearLabel,
  engineOn,
}: {
  speedKmh: number;
  rpmRatio: number;
  useKmh: boolean;
  accent: string;
  label: string;
  gearLabel: string;
  engineOn: boolean;
}) {
  const ratio = speedRatio(speedKmh);
  const hot = rpmRatio > 0.85;
  const ticks = React.useMemo(
    () =>
      Array.from({ length: 25 }, (_, index) => {
        const angle = (135 + (index * 270) / 24) * (Math.PI / 180);
        const major = index % 4 === 0;
        const outer = 118;
        const inner = major ? 108 : 113;
        return {
          x1: 130 + Math.cos(angle) * inner,
          y1: 130 + Math.sin(angle) * inner,
          x2: 130 + Math.cos(angle) * outer,
          y2: 130 + Math.sin(angle) * outer,
          major,
        };
      }),
    [],
  );

  return (
    <div
      className="relative size-[232px] shrink-0 sm:size-[290px] lg:size-[340px]"
      role="img"
      aria-label={`Velocidad ${formatSpeed(speedKmh, useKmh)} ${useKmh ? "kilómetros" : "millas"} por hora`}
    >
      <div
        className="absolute inset-[12%] rounded-full opacity-60 blur-3xl transition-colors duration-500"
        style={{ background: `radial-gradient(circle, ${hot ? "#fb7185" : accent}55, transparent 68%)` }}
      />
      <svg viewBox="0 0 260 260" className="relative size-full" aria-hidden="true">
        <path d={GAUGE_PATH} fill="none" stroke="rgba(255,255,255,0.12)" strokeLinecap="round" strokeWidth="4" />
        <path
          d={GAUGE_PATH}
          fill="none"
          pathLength={100}
          stroke={hot ? "#fb7185" : accent}
          strokeDasharray={`${Math.max(0.6, ratio * 100)} 100`}
          strokeLinecap="round"
          strokeWidth="4.5"
          style={{ filter: `drop-shadow(0 0 8px ${hot ? "#fb7185" : accent})`, transition: "stroke .3s" }}
        />
        <path d={RPM_PATH} fill="none" stroke="rgba(255,255,255,0.07)" strokeLinecap="round" strokeWidth="2.5" />
        <path
          d={RPM_PATH}
          fill="none"
          pathLength={100}
          stroke={hot ? "#fb7185" : "rgba(167,139,250,0.9)"}
          strokeDasharray={`${engineOn ? Math.max(0.5, rpmRatio * 100) : 0} 100`}
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        {ticks.map((tick, index) => (
          <line
            key={index}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)"}
            strokeWidth={tick.major ? 1.6 : 1}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-3">
        <span className="eyebrow !text-[9px] !tracking-[0.28em] text-white/45">{label}</span>
        <span
          className="mt-0.5 text-[4.6rem] font-light leading-none tracking-[-0.06em] text-white tabular-nums sm:text-[5.4rem] lg:text-[6.4rem]"
          style={{ textShadow: `0 0 42px ${accent}44` }}
        >
          {formatSpeed(speedKmh, useKmh)}
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
          {useKmh ? "km/h" : "mph"}
        </span>
        <span className="mt-3 flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
          <span className={cn("size-1.5 rounded-full", hot ? "bg-[#fb7185]" : "")} style={hot ? undefined : { backgroundColor: accent }} />
          {gearLabel}
        </span>
      </div>
    </div>
  );
}

function HoldButton({
  label,
  hint,
  icon: Icon,
  active,
  tone = "neutral",
  onPress,
}: {
  label: string;
  hint?: string;
  icon: typeof ChevronUp;
  active: boolean;
  tone?: "neutral" | "rev";
  onPress: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress(true);
      }}
      onPointerUp={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
      onPointerLeave={() => onPress(false)}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          onPress(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") onPress(false);
      }}
      className={cn(
        "flex min-h-14 min-w-[7.5rem] touch-none select-none flex-col items-center justify-center gap-0.5 rounded-2xl border px-4 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur-md transition-all",
        tone === "rev"
          ? active
            ? "border-[#fb7185] bg-[#fb7185] text-[#1a0609] shadow-[0_0_30px_rgba(251,113,133,0.55)]"
            : "border-[#fb7185]/60 bg-black/35 text-[#fda4af]"
          : active
            ? "border-white/35 bg-white/20 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]"
            : "border-white/12 bg-black/35 text-white/75",
      )}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      {hint ? <span className="text-[9px] font-medium normal-case tracking-[0.08em] opacity-70">{hint}</span> : null}
    </button>
  );
}

function RoundButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-12 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        active ? "border-[#34d399]/60 bg-[#34d399]/15 text-[#6ee7b7]" : "border-white/12 bg-black/30 text-white/75",
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
  className,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-xs font-semibold transition-colors",
        active ? "border-[#38bdf8]/70 bg-[#38bdf8]/15 text-[#7dd3fc]" : "border-white/12 bg-white/5 text-white/70",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DriveExperience() {
  const store = useDriveStore();
  const { engineId, sceneId, favorites, useKmh, volume, studio, autoScene, performanceMode, demoMode, silentMode } = store;
  const [autoLowDetail, setAutoLowDetail] = React.useState(false);
  const engine = React.useMemo(() => findEngine(engineId), [engineId]);
  const [muted, setMuted] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [studioOpen, setStudioOpen] = React.useState(false);
  const [hudHidden, setHudHidden] = React.useState(false);
  const [category, setCategory] = React.useState<EngineCategory | "all" | "fav">("all");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pedals, setPedals] = React.useState({ rev: false, accelerating: false, braking: false });
  const isTesla = React.useSyncExternalStore(
    () => () => undefined,
    () => isTeslaBrowser(navigator.userAgent),
    () => false,
  );
  const stageRef = React.useRef<HTMLDivElement>(null);
  const hudTimerRef = React.useRef<number | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const drive = useDriveEngine(engine, studio, silentMode ? volume * 0.25 : volume, muted);
  const {
    view,
    audioOn,
    audioError,
    parked,
    backend,
    setMode,
    setGpsSpeed,
    setPedal,
    shift,
    setManualGear,
    startAudio,
    stopAudio,
    setExternalDuck,
    setTurnRate,
  } = drive;

  const handleGeoFailure = React.useCallback(
    (message: string) => {
      setNotice(message);
      setMode("idle");
    },
    [setMode],
  );
  const geo = useDriveGeolocation(handleGeoFailure);
  const gpsActive = geo.status === "active" || geo.status === "requesting";
  const telemetry = useDriveTelemetry(geo, gpsActive && !demoMode);
  const stopGeolocation = geo.stop;
  const startGeolocation = geo.start;

  const weather = useWeather();
  const weatherGroup: WeatherGroup | null = weather.data ? describeWeather(weather.data.code).group : null;
  // Hora local sin desajuste de hidratación: el servidor no conoce la hora del Tesla.
  const clockHour = React.useSyncExternalStore(
    (onChange) => {
      const interval = window.setInterval(onChange, 60_000);
      return () => window.clearInterval(interval);
    },
    () => new Date().getHours(),
    () => -1,
  );
  const effectiveSceneId: DriveSceneId =
    autoScene && clockHour >= 0
      ? pickAutoScene({ hour: clockHour, month: new Date().getMonth() + 1, weather: weatherGroup })
      : sceneId;
  const scene = React.useMemo(() => findScene(effectiveSceneId), [effectiveSceneId]);
  const lowDetail = performanceMode || isTesla || autoLowDetail;

  React.useEffect(() => {
    void useDriveStore.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    setGpsSpeed(geo.status === "active" ? geo.speedKmh : 0);
  }, [geo.status, geo.speedKmh, setGpsSpeed]);

  React.useEffect(() => {
    setTurnRate(geo.status === "active" && !demoMode ? geo.turnRateDegPerSec : null);
  }, [geo.status, geo.turnRateDegPerSec, demoMode, setTurnRate]);

  React.useEffect(() => {
    drive.rendererRef.current?.setWeather(weatherGroup);
  }, [weatherGroup, drive.rendererRef]);

  // Modo cine solo mientras Drive está montado: se aplica al DOM sin tocar la
  // preferencia guardada, así una navegación brusca no deja la app en cine.
  React.useEffect(() => {
    if (!started) return;
    document.documentElement.dataset.displayMode = "cinema";
    return () => {
      document.documentElement.dataset.displayMode = usePreferences.getState().displayMode;
    };
  }, [started]);

  React.useEffect(() => {
    return () => {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      stopAudio();
      stopGeolocation();
      setMode("idle");
      setPedals({ rev: false, accelerating: false, braking: false });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [setMode, stopAudio, stopGeolocation]);

  // HUD que se oculta tras unos segundos sin tocar la pantalla.
  const wakeHud = React.useCallback(() => {
    setHudHidden(false);
    if (hudTimerRef.current !== null) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setHudHidden(true), HUD_HIDE_AFTER_SECONDS * 1_000);
  }, []);
  const hudVisible = !hudHidden || !started || panelOpen;

  React.useEffect(() => {
    if (!started || panelOpen) {
      if (hudTimerRef.current !== null) window.clearTimeout(hudTimerRef.current);
      return;
    }
    if (hudTimerRef.current !== null) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setHudHidden(true), HUD_HIDE_AFTER_SECONDS * 1_000);
    return () => {
      if (hudTimerRef.current !== null) window.clearTimeout(hudTimerRef.current);
    };
  }, [started, panelOpen]);

  // La radio o Spotify de fondo siguen sonando: el motor se mezcla, no los pausa.
  const ensureAudio = React.useCallback(async () => {
    if (audioOn) return true;
    return startAudio();
  }, [audioOn, startAudio]);

  // Arranque de un solo toque: audio + GPS + pantalla completa + wake lock.
  async function startAll() {
    setNotice(null);
    setStarted(true);
    try {
      if (!document.fullscreenElement) void stageRef.current?.requestFullscreen?.().catch(() => undefined);
    } catch {
      // Pantalla completa opcional.
    }
    try {
      wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLockRef.current = null;
    }
    const ok = await ensureAudio();
    if (demoMode) {
      setMode("idle");
    } else {
      setMode("gps");
      startGeolocation();
    }
    return ok;
  }

  async function toggleEngine() {
    if (audioOn) {
      stopAudio();
      if (view.mode === "rev" || view.mode === "launch" || view.mode === "cruise") setMode("idle");
      return;
    }
    setNotice(null);
    await ensureAudio();
  }

  async function startLaunch() {
    setNotice(null);
    stopGeolocation();
    await ensureAudio();
    setMode("launch");
  }

  async function toggleCruise() {
    setNotice(null);
    if (view.mode === "cruise") {
      setMode("idle");
      return;
    }
    stopGeolocation();
    await ensureAudio();
    setMode("cruise");
  }

  async function toggleGps() {
    setNotice(null);
    if (gpsActive) {
      stopGeolocation();
      setMode("idle");
      return;
    }
    await ensureAudio();
    setMode("gps");
    startGeolocation();
  }

  function handleRev(pressed: boolean) {
    setPedals((state) => ({ ...state, rev: pressed }));
    if (gpsActive && view.speedKmh > 1) return;
    if (pressed) {
      void ensureAudio();
      setMode("rev");
    } else {
      setMode(gpsActive ? "gps" : "idle");
    }
  }

  function handlePedal(pedal: "accelerating" | "braking", pressed: boolean) {
    setPedals((state) => ({ ...state, [pedal]: pressed }));
    if (pressed && gpsActive) return;
    if (pressed) void ensureAudio();
    setPedal(pedal, pressed);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setNotice("El navegador no permitió abrir pantalla completa.");
    }
  }

  function chooseScene(id: DriveSceneId) {
    store.setAutoScene(false);
    store.setScene(id);
  }

  // Puente con TECLA AI y con el resto de reproductores.
  React.useEffect(() => {
    const unregisterDrive = registerDriveController({
      engineOn: async () => {
        const ok = await ensureAudio();
        if (ok && !gpsActive && !demoMode) {
          setMode("gps");
          startGeolocation();
        }
        return ok
          ? { ok: true, message: `Motor ${engine.name} en línea.` }
          : { ok: false, message: "El navegador exige un toque en «Encender» para iniciar el audio." };
      },
      engineOff: () => {
        stopAudio();
        setMode("idle");
        return { ok: true, message: "Motor apagado." };
      },
      setEngine: (id) => store.setEngine(id),
      setScene: (id) => chooseScene(id),
      getState: () => ({
        engineOn: audioOn,
        engineName: engine.name,
        sceneLabel: scene.label,
        speedKmh: view.speedKmh,
        gps: gpsActive,
      }),
    });
    const unregisterMedia = registerMediaController({
      getSnapshot: () => ({
        active: true,
        kind: "drive",
        title: `TECLA Drive · ${engine.name}`,
        isPlaying: audioOn,
        positionSeconds: 0,
        durationSeconds: 0,
        canControl: true,
      }),
      play: async () => {
        setExternalDuck(1);
        return { ok: true, message: "Motor restaurado." };
      },
      pause: async () => {
        setExternalDuck(0.25);
        return { ok: true, message: "Motor atenuado." };
      },
      next: async () => {
        const list = favorites.length > 0 ? favorites : filterEngines("all", []).map((item) => item.id);
        const index = list.indexOf(engineId);
        const nextId = list[(index + 1) % list.length] ?? engineId;
        store.setEngine(nextId);
        return { ok: true, message: `Motor ${findEngine(nextId).name}.` };
      },
    });
    return () => {
      unregisterDrive();
      unregisterMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioOn, engine, scene, gpsActive, demoMode, view.speedKmh, favorites, engineId]);

  const rpmRatio = rpmNorm(engine, view.rpm);
  const stateLabel = parked && audioOn ? "ESTACIONADO" : describeDriveState(view);
  const gaugeLabel = gpsActive
    ? geo.status === "active"
      ? geo.quality === "poor"
        ? "GPS DÉBIL"
        : "GPS REAL"
      : "BUSCANDO GPS"
    : view.mode === "cruise"
      ? "PASEO"
      : view.mode === "launch"
        ? "0–100"
        : "SIMULADO";
  const gearLabel = engine.cylinders === 0 ? "D · EV" : `${view.manualGear ? "M" : "A"}${view.gear}`;
  const visibleEngines = React.useMemo(() => filterEngines(category, favorites), [category, favorites]);
  const gpsNote =
    geo.status === "active"
      ? geo.staleSeconds > 2
        ? `GPS sin señal hace ${Math.round(geo.staleSeconds)} s · manteniendo velocidad`
        : `GPS activo · precisión ±${Math.round(geo.accuracyM ?? 0)} m${geo.quality === "poor" ? " · señal débil" : ""}`
      : geo.status === "requesting"
        ? "Buscando señal GPS…"
        : demoMode
          ? "Modo demo · sin GPS"
          : "GPS apagado";
  const message = notice ?? audioError;
  const showRev = demoMode || !gpsActive || view.speedKmh < 1;
  const hudClass = cn("transition-opacity duration-500", hudVisible ? "opacity-100" : "pointer-events-none opacity-0");

  return (
    <div
      ref={stageRef}
      onPointerDown={wakeHud}
      onPointerMove={wakeHud}
      className="relative isolate min-h-[calc(100dvh-110px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#04060b] text-white shadow-[0_30px_100px_-30px_rgba(0,0,0,0.9)] lg:min-h-[calc(100dvh-125px)]"
    >
      <DriveCanvas
        scene={scene.id}
        frameRef={drive.frameRef}
        rendererRef={drive.rendererRef}
        lowDetail={lowDetail}
        onAutoLowDetail={() => setAutoLowDetail(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,9,0.5)_0%,transparent_26%,transparent_62%,rgba(2,5,9,0.78)_100%)]" />

      <div className="relative z-10 flex min-h-[calc(100dvh-110px)] flex-col p-3 sm:p-5 lg:min-h-[calc(100dvh-125px)] lg:p-7">
        <header className={cn("flex items-start justify-between gap-3", hudClass)}>
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Volver al inicio"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/75 backdrop-blur-md"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-[0.08em] sm:text-xl">
                TECLA <span className="font-light text-white/60">DRIVE</span>
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6ee7b7]">
                <span className={cn("size-1.5 rounded-full bg-current", audioOn && "animate-pulse")} />
                {stateLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "hidden items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] backdrop-blur-md sm:flex",
                geo.status === "active"
                  ? "border-[#34d399]/40 bg-[#34d399]/10 text-[#6ee7b7]"
                  : "border-white/12 bg-black/30 text-white/55",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  geo.status === "active"
                    ? geo.quality === "poor"
                      ? "bg-amber-300"
                      : "bg-[#34d399] shadow-[0_0_10px_#34d399]"
                    : geo.status === "requesting"
                      ? "animate-pulse bg-amber-300"
                      : "bg-white/35",
                )}
              />
              {geo.status === "active" ? "GPS en vivo" : geo.status === "requesting" ? "Buscando GPS" : demoMode ? "Demo" : "GPS apagado"}
            </span>
            <RoundButton label={muted ? "Activar sonido" : "Silenciar sonido"} onClick={() => setMuted((value) => !value)}>
              {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            </RoundButton>
            <RoundButton label="Pantalla completa" onClick={() => void toggleFullscreen()}>
              <Maximize2 className="size-4" aria-hidden />
            </RoundButton>
            <RoundButton label="Hablar con TECLA AI" onClick={() => openAssistant({ mode: "voice" })}>
              <Mic className="size-4" aria-hidden />
            </RoundButton>
            <RoundButton label="Sonidos y escenas" active={panelOpen} onClick={() => setPanelOpen((open) => !open)}>
              <SlidersHorizontal className="size-4" aria-hidden />
            </RoundButton>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center py-3 sm:py-5">
          <div className="flex flex-col items-center">
            <DriveGauge
              speedKmh={view.speedKmh}
              rpmRatio={rpmRatio}
              useKmh={useKmh}
              accent={scene.accent}
              label={gaugeLabel}
              gearLabel={gearLabel}
              engineOn={audioOn}
            />
            {engine.cylinders > 0 ? (
              <div className={cn("mt-2 flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 p-1 backdrop-blur-md", hudClass)}>
                <button type="button" aria-label="Bajar marcha" onClick={() => shift(-1)} className="flex size-12 items-center justify-center rounded-full text-xl text-white/80">
                  −
                </button>
                <button
                  type="button"
                  aria-pressed={!view.manualGear}
                  onClick={() => setManualGear(false)}
                  className={cn("min-h-11 rounded-full px-3 text-[10px] font-bold tracking-[0.12em]", !view.manualGear ? "bg-white/18 text-white" : "text-white/55")}
                >
                  AUTO
                </button>
                <span className="min-w-8 text-center text-xl font-semibold tabular-nums">{view.gear}</span>
                <button
                  type="button"
                  aria-pressed={view.manualGear}
                  onClick={() => setManualGear(true)}
                  className={cn("min-h-11 rounded-full px-3 text-[10px] font-bold tracking-[0.12em]", view.manualGear ? "bg-white/18 text-white" : "text-white/55")}
                >
                  MANUAL
                </button>
                <button type="button" aria-label="Subir marcha" onClick={() => shift(1)} className="flex size-12 items-center justify-center rounded-full text-xl text-white/80">
                  +
                </button>
              </div>
            ) : null}
          </div>

          <div className={cn("mt-4 flex w-full max-w-[520px] flex-wrap justify-center gap-2 lg:absolute lg:right-0 lg:top-1/2 lg:mt-0 lg:w-auto lg:max-w-none lg:-translate-y-1/2 lg:flex-col", hudClass)}>
            {!demoMode ? (
              <button
                type="button"
                onClick={() => void toggleGps()}
                aria-pressed={gpsActive}
                className={cn(
                  "flex min-h-14 min-w-[7.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-4 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur-md transition-colors",
                  gpsActive ? "border-[#34d399]/60 bg-[#34d399]/15 text-[#6ee7b7]" : "border-white/12 bg-black/35 text-white/75",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Navigation className="size-4" aria-hidden />
                  {gpsActive ? "Desactivar GPS" : "Activar GPS"}
                </span>
                <span className="text-[9px] font-medium normal-case tracking-[0.08em] opacity-70">
                  {gpsActive ? "Velocidad real" : "Usa tu velocidad real"}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => store.setUseKmh(!useKmh)}
              aria-label="Cambiar unidades de velocidad"
              className="flex min-h-14 min-w-[7.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 bg-black/35 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/75 backdrop-blur-md"
            >
              <span className="flex items-center gap-1.5">
                <Gauge className="size-4" aria-hidden />
                {useKmh ? "km/h" : "mph"}
              </span>
              <span className="text-[9px] font-medium normal-case tracking-[0.08em] opacity-70">Unidades</span>
            </button>
            {showRev ? (
              <HoldButton label="REV" hint="Mantén pulsado" icon={Zap} tone="rev" active={pedals.rev} onPress={handleRev} />
            ) : null}
            {demoMode ? (
              <>
                <HoldButton label="Acelerar" hint="Mantén pulsado" icon={ChevronUp} active={pedals.accelerating} onPress={(pressed) => handlePedal("accelerating", pressed)} />
                <HoldButton label="Frenar" hint="Mantén pulsado" icon={ChevronDown} active={pedals.braking} onPress={(pressed) => handlePedal("braking", pressed)} />
              </>
            ) : null}
          </div>
        </div>

        {geo.status === "active" && !demoMode ? (
          <DriveTelemetry
            geo={geo}
            trip={telemetry.trip}
            launch={telemetry.launch}
            bestLaunchMs={telemetry.bestLaunchMs}
            useKmh={useKmh}
            accent={scene.accent}
            onReset={telemetry.reset}
            className={cn("mb-3", hudClass)}
          />
        ) : null}

        <div className={cn("flex flex-wrap items-end justify-between gap-3", hudClass)}>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/55">Sonido</p>
            <p className="truncate text-base font-semibold">{engine.name}</p>
            <p className="truncate text-[10px] text-white/50">{engine.sub}</p>
          </div>
          <div className="w-full max-w-[260px] sm:w-[260px]">
            <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
              <span>RPM</span>
              <span className="tabular-nums">{audioOn ? Math.round(view.rpm) : "—"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a78bfa_70%,#fb7185)] transition-[width] duration-100"
                style={{ width: `${Math.max(3, rpmRatio * 100)}%` }}
              />
            </div>
          </div>
          <p className="hidden text-[10px] text-white/45 sm:block">
            {gpsNote}
            {parked && audioOn ? " · estacionado, volumen bajo" : ""}
          </p>
        </div>

        {message ? (
          <p role="alert" className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
            {message}
          </p>
        ) : null}

        <div className={cn("mt-3 flex flex-col gap-2 sm:flex-row sm:items-center", hudClass)}>
          <button
            type="button"
            onClick={() => void toggleEngine()}
            className={cn(
              "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-all",
              audioOn
                ? "border border-[#fb7185]/50 bg-[#fb7185]/15 text-white"
                : "bg-[linear-gradient(135deg,#38bdf8,#6366f1)] text-[#061018] shadow-[0_16px_42px_-18px_rgba(56,189,248,0.95)]",
            )}
          >
            {audioOn ? <Square className="size-4 fill-current" aria-hidden /> : <Power className="size-4" aria-hidden />}
            {audioOn ? "Apagar motor" : "Encender motor"}
          </button>
          {demoMode ? (
            <>
              <button
                type="button"
                onClick={() => void toggleCruise()}
                aria-pressed={view.mode === "cruise"}
                className={cn(
                  "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-all",
                  view.mode === "cruise"
                    ? "border border-[#34d399]/60 bg-[#34d399]/15 text-white"
                    : "bg-[linear-gradient(135deg,#34d399,#0ea5e9)] text-[#061018] shadow-[0_16px_42px_-18px_rgba(52,211,153,0.95)]",
                )}
              >
                <Navigation className="size-4" aria-hidden />
                {view.mode === "cruise" ? "Detener paseo" : "Paseo automático"}
              </button>
              <button
                type="button"
                onClick={() => void startLaunch()}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md"
              >
                <Play className="size-4 fill-current" aria-hidden />
                Arrancada 0–100
              </button>
            </>
          ) : null}
        </div>

        <footer className={cn("mt-3 hidden flex-wrap items-center justify-between gap-2 text-[9px] leading-relaxed text-white/35 sm:flex", hudClass)}>
          <span>
            GPS opcional: la ubicación se procesa en tu navegador y no se guarda. Velocímetro hasta {MAX_SPEED} km/h.
            {backend ? ` · audio ${backend === "worklet" ? "en hilo dedicado" : "en hilo principal"}` : ""}
            {lowDetail ? " · modo rendimiento" : ""}
            {silentMode ? " · silencioso" : ""}
          </span>
          <span>No manipules la pantalla mientras conduces.</span>
        </footer>
      </div>

      {!started ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[rgba(2,5,9,0.72)] p-6 text-center backdrop-blur-md">
          <p className="eyebrow !text-[10px] !tracking-[0.3em] text-white/55">TECLA DRIVE</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[0.04em] sm:text-3xl">{engine.name}</h2>
          <p className="mt-1 text-[11px] text-white/55">
            Escena {scene.label}
            {autoScene ? " · automática por hora y clima" : ""}
          </p>
          <button
            type="button"
            onClick={() => void startAll()}
            aria-label="Arrancar TECLA Drive"
            className="mt-7 flex min-h-20 min-w-[280px] flex-col items-center justify-center rounded-[1.6rem] bg-[linear-gradient(135deg,#38bdf8,#6366f1)] px-8 text-[#061018] shadow-[0_24px_60px_-20px_rgba(56,189,248,0.95)]"
          >
            <span className="flex items-center gap-2 text-lg font-bold">
              <Power className="size-5" aria-hidden />
              Tocar para encender
            </span>
            <span className="text-[11px] font-medium opacity-75">
              {demoMode ? "Motor en modo demo, sin GPS" : "Motor + GPS + pantalla completa, en un toque"}
            </span>
          </button>
          <p className="mt-4 max-w-[420px] text-[10px] leading-relaxed text-white/45">
            El navegador exige un toque para iniciar el audio. La ubicación se usa solo aquí y no se guarda.
          </p>
          <button
            type="button"
            onClick={() => store.setDemoMode(!demoMode)}
            aria-pressed={demoMode}
            aria-label="Modo demo"
            className="mt-3 min-h-11 rounded-full border border-white/15 px-4 text-[11px] font-semibold text-white/70"
          >
            {demoMode ? "Usar GPS real" : "Sin GPS: modo demo"}
          </button>
        </div>
      ) : null}

      <section
        id="drive-drawer"
        aria-label="Sonidos y escenas"
        aria-hidden={!panelOpen}
        className={cn(
          "absolute inset-x-2 bottom-2 z-30 max-h-[72%] overflow-y-auto rounded-[1.6rem] border border-white/12 bg-black/80 p-4 backdrop-blur-2xl transition-all duration-300 sm:inset-x-6 sm:p-5",
          panelOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Sonidos y escenas</h2>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Cerrar panel"
            className="flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Escenario</h3>
          <Chip active={autoScene} onClick={() => store.setAutoScene(true)} label="Escena automática">
            Automática
          </Chip>
          {DRIVE_SCENES.map((item) => {
            const active = !autoScene && item.id === sceneId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => chooseScene(item.id)}
                className={cn(
                  "relative min-h-11 overflow-hidden rounded-full border px-4 text-xs font-semibold transition-colors",
                  active ? "border-white/60 text-white" : "border-white/12 text-white/70",
                )}
              >
                <span className={cn("absolute inset-0 bg-gradient-to-br", item.swatch, active ? "opacity-70" : "opacity-35")} />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/50">
          {autoScene ? `Ahora: ${scene.label}. ` : ""}
          {scene.subtitle}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip active={demoMode} onClick={() => store.setDemoMode(!demoMode)} label="Modo demo">
            Modo demo (sin GPS)
          </Chip>
          <Chip active={performanceMode} onClick={() => store.setPerformanceMode(!performanceMode)} label="Modo rendimiento">
            Modo rendimiento{isTesla ? " · auto en Tesla" : autoLowDetail ? " · activado por fps" : ""}
          </Chip>
          <Chip active={silentMode} onClick={() => store.setSilentMode(!silentMode)} label="Modo silencioso">
            Modo silencioso
          </Chip>
          <Chip active={studioOpen} onClick={() => setStudioOpen((open) => !open)} label="Estudio de sonido">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Estudio de sonido
            </span>
          </Chip>
          <div className="ml-auto flex min-w-[180px] items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/65"
            >
              {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            </button>
            <input
              type="range"
              min="10"
              max="150"
              value={Math.round(volume * 100)}
              onChange={(event) => {
                store.setVolume(Number(event.target.value) / 100);
                if (muted) setMuted(false);
              }}
              aria-label="Volumen del motor"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#38bdf8]"
            />
            <span className="w-10 text-right text-[10px] tabular-nums text-white/60">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {studioOpen ? (
          <div className="mt-3 grid gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {STUDIO_SLIDERS.map((slider) => {
              const value = studio[slider.key];
              return (
                <label key={slider.key} className="block text-[11px] text-white/60">
                  <span className="mb-1.5 flex justify-between">
                    <span>{slider.label}</span>
                    <span className="tabular-nums text-white/85">
                      {slider.format === "factor" ? `${value.toFixed(2)}x` : `${Math.round(value * 100)}%`}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    value={Math.round(value * 100)}
                    onChange={(event) => store.setStudio({ [slider.key]: Number(event.target.value) / 100 })}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#38bdf8]"
                  />
                </label>
              );
            })}
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => store.resetStudio()}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 text-xs font-semibold text-white/75"
              >
                <RotateCcw className="size-4" aria-hidden />
                Reiniciar estudio
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Motores</h3>
          {ENGINE_CATEGORIES.map((item) => (
            <Chip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleEngines.length === 0 ? (
            <p className="col-span-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/55">
              Aún no tienes favoritos. Toca la estrella de un motor para guardarlo aquí.
            </p>
          ) : null}
          {visibleEngines.map((item) => {
            const active = item.id === engine.id;
            const favorite = favorites.includes(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex min-h-14 items-center gap-2 rounded-2xl border pl-4 pr-2 transition-colors",
                  active ? "border-[#38bdf8]/70 bg-[#38bdf8]/12" : "border-white/10 bg-white/[0.04]",
                )}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => store.setEngine(item.id)}
                  className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center text-left"
                >
                  <span className="truncate text-[13px] font-semibold text-white">{item.name}</span>
                  <span className="truncate text-[10px] text-white/50">{item.sub}</span>
                </button>
                <button
                  type="button"
                  aria-label={favorite ? `Quitar ${item.name} de favoritos` : `Guardar ${item.name} en favoritos`}
                  aria-pressed={favorite}
                  onClick={() => store.toggleFavorite(item.id)}
                  className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", favorite ? "text-amber-300" : "text-white/35")}
                >
                  <Star className={cn("size-4", favorite && "fill-current")} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/45">{engine.description}</p>
      </section>
    </div>
  );
}
