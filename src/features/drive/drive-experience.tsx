"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Navigation,
  Play,
  Square,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMediaController } from "@/features/media/player-bridge";
import { DriveAudioEngine } from "./audio-engine";
import { DriveCanvas } from "./drive-canvas";
import { useDriveGeolocation } from "./drive-geolocation";
import {
  DRIVE_SCENES,
  DRIVE_SOUNDS,
  MAX_SPEED,
  findScene,
  findSound,
  formatSpeed,
  speedRatio,
  type DriveSceneId,
  type DriveSoundId,
} from "./drive-config";
import { useDriveSimulation } from "./use-drive-simulation";

function DriveGauge({
  speed,
  accent,
  label,
}: {
  speed: number;
  accent: string;
  label: string;
}) {
  const ratio = speedRatio(speed);
  const path = "M 53.64 206.36 A 108 108 0 1 1 206.36 206.36";
  const ticks = Array.from({ length: 29 }, (_, index) => {
    const angle = (135 + (index * 270) / 28) * (Math.PI / 180);
    const major = index % 5 === 0;
    const outer = 105;
    const inner = major ? 94 : 99;
    return {
      x1: 130 + Math.cos(angle) * inner,
      y1: 130 + Math.sin(angle) * inner,
      x2: 130 + Math.cos(angle) * outer,
      y2: 130 + Math.sin(angle) * outer,
      major,
    };
  });

  return (
    <div
      className="relative size-[224px] shrink-0 sm:size-[292px]"
      role="img"
      aria-label={`Velocidad ${formatSpeed(speed)} kilómetros por hora`}
    >
      <div
        className="absolute inset-[14%] rounded-full opacity-70 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}55, transparent 68%)` }}
      />
      <svg viewBox="0 0 260 260" className="relative size-full" aria-hidden="true">
        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d={path}
          fill="none"
          pathLength={100}
          stroke={accent}
          strokeDasharray={`${ratio * 100} 100`}
          strokeLinecap="round"
          strokeWidth="3"
          className="transition-[stroke-dasharray] duration-150"
        />
        {ticks.map((tick, index) => (
          <line
            key={index}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.2)"}
            strokeWidth={tick.major ? 1.5 : 1}
            strokeLinecap="round"
          />
        ))}
        <circle
          cx="130"
          cy="130"
          r="76"
          fill="none"
          stroke="rgba(255,255,255,0.055)"
          strokeWidth="1"
          strokeDasharray="1 7"
        />
        <line
          x1="130"
          y1="207"
          x2="130"
          y2="214"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-5">
        <span className="eyebrow !text-[9px] !tracking-[0.28em] text-white/40">{label}</span>
        <span
          className="mt-1 text-[4.4rem] font-medium leading-none tracking-[-0.08em] text-white tabular-nums sm:text-[5.2rem]"
          style={{ textShadow: `0 0 42px ${accent}33` }}
        >
          {formatSpeed(speed)}
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.26em] text-white/45">
          km/h
        </span>
        <span className="mt-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white/50">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {speed > 0 ? "En movimiento" : "En pausa"}
        </span>
      </div>
    </div>
  );
}

function HoldButton({
  label,
  icon: Icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: typeof ChevronUp;
  active: boolean;
  disabled: boolean;
  onPress: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress(true);
      }}
      onPointerUp={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
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
        "flex min-h-12 touch-none items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-medium transition-all",
        active
          ? "border-white/30 bg-white/15 text-white shadow-[0_0_24px_rgba(255,255,255,0.08)]"
          : "border-white/10 bg-white/[0.045] text-white/70 hover:border-white/20 hover:bg-white/[0.08]",
        disabled && "cursor-not-allowed opacity-35",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function DriveExperience() {
  const [sound, setSound] = React.useState<DriveSoundId>("electric");
  const [scene, setScene] = React.useState<DriveSceneId>("orbit");
  const [mode, setMode] = React.useState<"gps" | "demo">("gps");
  const [volume, setVolume] = React.useState(0.55);
  const [muted, setMuted] = React.useState(false);
  const [audioActive, setAudioActive] = React.useState(false);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const engineRef = React.useRef<DriveAudioEngine | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const simulation = useDriveSimulation();
  const handleGeoError = React.useCallback((message: string) => {
    setAudioError(message);
    engineRef.current?.stop();
    setAudioActive(false);
  }, []);
  const geo = useDriveGeolocation(handleGeoError);
  const currentSound = findSound(sound);
  const currentScene = findScene(scene);
  const gpsMode = mode === "gps";
  const speed = gpsMode ? geo.speedKmh : simulation.speed;
  const inMotion = speed > 0.5;
  const stopSimulatedDrive = simulation.stop;
  const stopGeolocation = geo.stop;
  const gpsLabel =
    geo.status === "active"
      ? `GPS ±${Math.round(geo.accuracyM ?? 0)} m`
      : geo.status === "requesting"
        ? "Buscando GPS…"
        : geo.status === "idle"
          ? "GPS opcional"
          : "GPS no disponible";

  const getEngine = React.useCallback(() => {
    if (!engineRef.current) engineRef.current = new DriveAudioEngine();
    return engineRef.current;
  }, []);

  React.useEffect(() => {
    return () => engineRef.current?.dispose();
  }, []);

  React.useEffect(() => {
    const throttle = gpsMode
      ? speed > 1
        ? 0.35
        : 0
      : simulation.accelerating || simulation.autoPilot
        ? 1
        : 0;
    engineRef.current?.update(speed, throttle);
  }, [speed, gpsMode, simulation.accelerating, simulation.autoPilot]);

  React.useEffect(() => {
    engineRef.current?.setPreset(sound);
  }, [sound]);

  React.useEffect(() => {
    engineRef.current?.setVolume(volume);
    engineRef.current?.setMuted(muted);
  }, [volume, muted]);

  React.useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden || !audioActive) return;
      engineRef.current?.stop();
      setAudioActive(false);
      stopSimulatedDrive();
      stopGeolocation();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [audioActive, stopGeolocation, stopSimulatedDrive]);

  async function start() {
    setAudioError(null);
    const media = getMediaController();
    if (media?.getSnapshot().isPlaying) void media.pause();
    const engine = getEngine();
    engine.setVolume(volume);
    engine.setMuted(muted);
    try {
      await engine.start(sound);
    } catch {
      setAudioError("El navegador no permitió iniciar el audio. El paisaje sigue disponible.");
    }
    setAudioActive(true);
    if (gpsMode) geo.start();
    else simulation.start();
  }

  function stop() {
    engineRef.current?.stop();
    setAudioActive(false);
    geo.stop();
    simulation.stop();
  }

  function changeMode(next: "gps" | "demo") {
    if (next === mode) return;
    if (audioActive) stop();
    setMode(next);
    setAudioError(null);
  }

  function toggleMuted() {
    setMuted((value) => !value);
  }

  function updateVolume(next: number) {
    setVolume(next);
    if (next > 0 && muted) setMuted(false);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageRef.current?.requestFullscreen();
      }
    } catch {
      setAudioError("El navegador no permitió abrir pantalla completa.");
    }
  }

  return (
    <div
      ref={stageRef}
      className="relative isolate min-h-[calc(100dvh-110px)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#04070c] text-white shadow-[0_30px_100px_-30px_rgba(0,0,0,0.9)] lg:min-h-[calc(100dvh-125px)]"
    >
      <DriveCanvas scene={scene} speed={speed} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,9,0.42)_0%,transparent_30%,transparent_58%,rgba(2,5,9,0.86)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(to_bottom,black,transparent_54%)]" />

      <div className="relative z-10 flex min-h-[calc(100dvh-110px)] flex-col p-4 sm:p-5 md:p-7 lg:min-h-[calc(100dvh-125px)] lg:p-8">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/"
              aria-label="Volver al inicio"
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <p className="eyebrow !text-[9px] !tracking-[0.28em] text-white/40">
                Experiencia TECLA
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-[0.03em] sm:text-2xl">
                TECLA <span className="font-light text-white/55">DRIVE</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-2 text-[9px] font-medium uppercase tracking-[0.15em] text-white/50 backdrop-blur-md sm:flex">
              <span
                className={cn(
                  "size-1.5 rounded-full shadow-[0_0_10px_currentColor]",
                  geo.status === "active"
                    ? "bg-[#5eead4] text-[#5eead4]"
                    : geo.status === "requesting"
                      ? "animate-pulse bg-amber-300 text-amber-300"
                      : "bg-white/35 text-white/35",
                )}
              />
              {gpsMode ? gpsLabel : "Demo estacionaria"}
            </span>
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
              className="flex size-10 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
            >
              {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label="Pantalla completa"
              className="flex size-10 items-center justify-center rounded-full border border-white/12 bg-black/25 text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-7">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/45">
            <span className="size-1 rounded-full" style={{ backgroundColor: currentScene.accent }} />
            {currentScene.label}
            <span className="text-white/20">·</span>
            {currentSound.label}
          </div>
          <DriveGauge
            speed={speed}
            accent={currentScene.accent}
            label={gpsMode ? (geo.status === "active" ? "GPS REAL" : "GPS") : "SIMULADO"}
          />
          <p className="mt-3 hidden max-w-[420px] text-center text-[11px] leading-relaxed text-white/45 sm:block">
            {gpsMode
              ? geo.status === "active"
                ? "Velocidad, paisaje y sonido siguen tu GPS. La ubicación no se guarda."
                : geo.status === "requesting"
                  ? "Buscando señal GPS. Acepta el permiso de ubicación."
                  : "Activa GPS para usar tu velocidad real."
              : inMotion
                ? simulation.autoPilot
                  ? "Paseo virtual en curso. La velocidad es una simulación."
                  : "Paisaje y sonido responden a tu pie. Todo ocurre en esta pantalla."
                : currentScene.subtitle}
          </p>
          <div className="mt-2 flex items-center gap-2 sm:mt-3">
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
              {gpsMode ? "GPS" : simulation.autoPilot ? "AUTO" : "MANUAL"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
              {formatSpeed(speed)} / {MAX_SPEED} km/h
            </span>
          </div>
          <button
            type="button"
            onClick={() => (audioActive ? stop() : void start())}
            className={cn(
              "mt-4 flex min-h-12 w-full max-w-[260px] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all sm:hidden",
              audioActive
                ? "border border-white/15 bg-white/10 text-white"
                : "bg-[#ff6b4a] text-[#1a0703] shadow-[0_16px_42px_-18px_rgba(255,107,74,0.95)]",
            )}
          >
            {audioActive ? (
              <>
                <Square className="size-3.5 fill-current" aria-hidden />
                Detener paseo
              </>
            ) : (
              <>
                {gpsMode ? <Navigation className="size-4" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
                {gpsMode ? "Activar GPS" : "Iniciar paseo"}
                <span className="ml-1 text-[10px] font-normal opacity-60">
                  {gpsMode ? "Velocidad real" : "0–100"}
                </span>
              </>
            )}
          </button>
        </div>

        <div className="mt-auto rounded-[1.6rem] border border-white/12 bg-black/35 p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-white/35">
              <Navigation className="size-3" aria-hidden />
              Fuente de velocidad
            </div>
            <div
              role="group"
              aria-label="Fuente de velocidad"
              className="flex rounded-full border border-white/10 bg-black/25 p-0.5"
            >
              <button
                type="button"
                aria-pressed={gpsMode}
                onClick={() => changeMode("gps")}
                className={cn(
                  "min-h-8 rounded-full px-3 text-[10px] font-medium transition-colors",
                  gpsMode ? "bg-white/15 text-white" : "text-white/45 hover:text-white/75",
                )}
              >
                GPS real
              </button>
              <button
                type="button"
                aria-pressed={!gpsMode}
                onClick={() => changeMode("demo")}
                className={cn(
                  "min-h-8 rounded-full px-3 text-[10px] font-medium transition-colors",
                  !gpsMode ? "bg-white/15 text-white" : "text-white/45 hover:text-white/75",
                )}
              >
                Demo
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr] lg:gap-6">
            <section aria-label="Sonido de conducción" className="min-w-0">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="eyebrow !text-[9px] !tracking-[0.22em] text-white/40">Sonido</p>
                <span className="text-[9px] text-white/30">OSCILADORES · SIN SAMPLES</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:overflow-x-auto sm:pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {DRIVE_SOUNDS.map((item) => {
                  const active = item.id === sound;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSound(item.id)}
                      className={cn(
                        "flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-[11px] font-medium transition-colors sm:justify-start",
                        active
                          ? "border-white/30 bg-white/12 text-white"
                          : "border-white/10 bg-white/[0.035] text-white/55 hover:border-white/20 hover:text-white/80",
                      )}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 hidden line-clamp-2 text-[10px] leading-relaxed text-white/40 sm:block">
                {currentSound.subtitle}
              </p>
            </section>

            <section aria-label="Escenario de conducción" className="min-w-0">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="eyebrow !text-[9px] !tracking-[0.22em] text-white/40">Escena</p>
                <span className="text-[9px] text-white/30">CANVAS LOCAL</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DRIVE_SCENES.map((item) => {
                  const active = item.id === scene;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setScene(item.id)}
                      className={cn(
                        "group relative min-h-10 overflow-hidden rounded-xl border px-2 text-left transition-colors",
                        active ? "border-white/35" : "border-white/10 hover:border-white/25",
                      )}
                    >
                      <span className={cn("absolute inset-0 bg-gradient-to-br opacity-50", item.swatch)} />
                      <span className="relative text-[10px] font-medium text-white/85">{item.label}</span>
                      {active ? (
                        <span className="absolute bottom-1 left-2 h-px w-5" style={{ backgroundColor: item.accent }} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => (audioActive ? stop() : void start())}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all sm:shrink-0",
                audioActive
                  ? "border border-white/15 bg-white/10 text-white hover:bg-white/15"
                  : "bg-[#ff6b4a] text-[#1a0703] shadow-[0_16px_42px_-18px_rgba(255,107,74,0.95)] hover:brightness-105",
                "hidden sm:flex",
              )}
            >
              {audioActive ? (
                <>
                  <Square className="size-3.5 fill-current" aria-hidden />
                  Detener paseo
                </>
              ) : (
                <>
                  {gpsMode ? <Navigation className="size-4" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
                  {gpsMode ? "Activar GPS" : "Iniciar paseo"}
                  <span className="ml-1 text-[10px] font-normal opacity-60">
                    {gpsMode ? "Velocidad real" : "0–100"}
                  </span>
                </>
              )}
            </button>

            {gpsMode ? (
              <div className="flex min-h-12 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 text-[10px] text-white/55">
                <span className="flex items-center gap-1.5 text-white/75">
                  <Navigation className="size-3.5" aria-hidden />
                  {geo.status === "active"
                    ? `GPS activo · precisión ±${Math.round(geo.accuracyM ?? 0)} m`
                    : geo.status === "requesting"
                      ? "Solicitando GPS…"
                      : "GPS inactivo"}
                </span>
                <span className="hidden text-white/35 sm:inline">
                  La ubicación se procesa solo en este navegador.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1">
                <HoldButton
                  label="Acelerar"
                  icon={ChevronUp}
                  active={simulation.accelerating}
                  disabled={!audioActive}
                  onPress={(pressed) => simulation.setPedal("accelerating", pressed)}
                />
                <HoldButton
                  label="Frenar"
                  icon={ChevronDown}
                  active={simulation.braking}
                  disabled={!audioActive}
                  onPress={(pressed) => simulation.setPedal("braking", pressed)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 sm:ml-auto sm:w-40">
              <button
                type="button"
                onClick={toggleMuted}
                aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={(event) => updateVolume(Number(event.target.value) / 100)}
                aria-label="Volumen del sonido"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#5eead4]"
              />
            </div>
          </div>

          {audioError ? (
            <p role="alert" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[10px] leading-relaxed text-amber-100/80">
              {audioError}
            </p>
          ) : null}
        </div>

        <footer className="mt-3 hidden flex-wrap items-center justify-between gap-2 text-[9px] leading-relaxed text-white/30 sm:flex">
          <span className="flex items-center gap-1.5">
            <Wind className="size-3" aria-hidden />
            GPS opcional: la ubicación se procesa en tu navegador y no se guarda.
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3" aria-hidden />
            No manipules la pantalla mientras conduces.
          </span>
        </footer>
      </div>
    </div>
  );
}
