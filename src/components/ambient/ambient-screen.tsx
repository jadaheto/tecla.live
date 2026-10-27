"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Mic, Pause, Play, SkipForward } from "lucide-react";
import { WeatherGlyph } from "@/components/weather/weather-glyph";
import { ambientDrift, formatAmbientTime, shouldAutoAmbient } from "@/features/ambient/ambient-rules";
import { openAssistant } from "@/features/ai/open-assistant";
import { useAi } from "@/features/ai/store";
import { useWeather } from "@/features/integrations/hooks";
import { chargingLabel } from "@/features/tesla/hooks";
import { useTeslaLive } from "@/features/tesla/store";
import { getMediaController, getPageController } from "@/features/media/player-bridge";
import { weatherFxPalette } from "@/features/weather/fx-presets";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

const IDLE_EVENTS: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"];

/**
 * Pantalla ambiente: reloj grande, clima, carátula y controles sobre fondo
 * negro con partículas del estilo activo. Pensada para el auto detenido o
 * cargando (Supercargador): evita el quemado desplazando el contenido cada
 * minuto. Se abre desde la cabecera, por voz, o sola tras N minutos sin tocar.
 */
export function AmbientScreen() {
  const pathname = usePathname();
  const open = useUi((state) => state.ambientOpen);
  const setOpen = useUi((state) => state.setAmbientOpen);
  const idleMinutes = usePreferences((state) => state.ambientIdleMinutes);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const lastActivityRef = React.useRef(0);

  // Vigila la inactividad y abre la pantalla ambiente sola.
  React.useEffect(() => {
    lastActivityRef.current = Date.now();
    const touch = () => {
      lastActivityRef.current = Date.now();
    };
    for (const event of IDLE_EVENTS) window.addEventListener(event, touch, { passive: true });
    const timer = window.setInterval(() => {
      if (useUi.getState().ambientOpen) return;
      const ai = useAi.getState();
      const ui = useUi.getState();
      const page = getPageController()?.getSnapshot();
      const videoOnScreen = Boolean(page && (page.kind === "youtube" || page.kind === "iptv" || page.kind === "drive") && page.isPlaying);
      if (
        shouldAutoAmbient({
          idleMinutes: usePreferences.getState().ambientIdleMinutes,
          idleMs: Date.now() - lastActivityRef.current,
          pathname,
          videoOnScreen,
          assistantOpen: ai.panelOpen || ai.voiceOpen,
          overlayOpen: ui.searchOpen || ui.shortcutsOpen || ui.remoteOpen,
          parked: useTeslaLive.getState().parked,
        })
      ) {
        setOpen(true);
      }
    }, 15_000);
    return () => {
      for (const event of IDLE_EVENTS) window.removeEventListener(event, touch);
      window.clearInterval(timer);
    };
  }, [pathname, setOpen, idleMinutes]);

  // Al navegar, la pantalla ambiente se cierra.
  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    if (pathRef.current !== pathname) {
      pathRef.current = pathname;
      if (useUi.getState().ambientOpen) setOpen(false);
    }
  }, [pathname, setOpen]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return <AmbientStage style={visualStyle} reduceMotion={reduceMotion} onClose={() => setOpen(false)} />;
}

function AmbientStage({ style, reduceMotion, onClose }: { style: string; reduceMotion: boolean; onClose: () => void }) {
  const weather = useWeather();
  const tesla = useTeslaLive((state) => state.snapshot);
  const current = usePlayer((state) => state.current);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const [now, setNow] = React.useState(() => new Date());
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Partículas lentas con el color del estilo (las mismas que usan las estrellas del clima).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduceMotion) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const palette = weatherFxPalette(style as "tecla" | "cyberpunk" | "kitt" | "roadster", true, false);
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();
    const motes = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }));
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    const draw = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      context.clearRect(0, 0, width, height);
      context.fillStyle = palette.star;
      for (const mote of motes) {
        mote.phase += dt * 0.6;
        mote.y -= dt * 0.006 * mote.z;
        mote.x += Math.sin(mote.phase) * dt * 0.004;
        if (mote.y < -0.02) {
          mote.y = 1.02;
          mote.x = Math.random();
        }
        context.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(mote.phase * 1.3));
        context.beginPath();
        context.arc(mote.x * width, mote.y * height, 0.8 + mote.z * 1.6, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [style, reduceMotion]);

  const clock = formatAmbientTime(now);
  const drift = ambientDrift(Math.floor(now.getTime() / 60_000));
  const controller = getMediaController();

  return (
    <div
      className="ambient-screen"
      data-style={style}
      role="dialog"
      aria-label="Pantalla ambiente"
      onClick={onClose}
    >
      <canvas ref={canvasRef} className="ambient-screen__canvas" aria-hidden />
      <div className="ambient-screen__vignette" aria-hidden />
      <div
        className="ambient-screen__content"
        style={{ transform: reduceMotion ? undefined : `translate(${drift.x}px, ${drift.y}px)` }}
      >
        <div className="ambient-screen__clock">
          <span className="ambient-screen__time">{clock.time}</span>
          <span className="ambient-screen__seconds">{clock.seconds}</span>
        </div>
        <p className="ambient-screen__date">{clock.date}</p>

        {weather.data ? (
          <div className="ambient-screen__weather">
            <WeatherGlyph code={weather.data.code} isDay={weather.data.isDay} className="size-8" />
            <span className="ambient-screen__temp">{Math.round(weather.data.temperature)}°</span>
            <span className="ambient-screen__weather-label">
              {weather.data.label} · {weather.data.location.split(",")[0]?.trim()}
            </span>
          </div>
        ) : null}

        {tesla && !tesla.asleep && tesla.batteryPercent !== null ? (
          tesla.charging === "charging" ? (
            <div className="ambient-screen__charge" aria-label="Carga en curso">
              <p className="ambient-screen__charge-kind">Cargando{tesla.chargerPowerKw ? ` · ${tesla.chargerPowerKw} kW` : ""}</p>
              <p className="ambient-screen__charge-level">
                {tesla.batteryPercent}%<span className="ambient-screen__charge-limit"> → {tesla.chargeLimitPercent ?? 100}%</span>
              </p>
              <div className="ambient-screen__charge-bar" aria-hidden>
                <span style={{ width: `${Math.max(2, Math.min(100, tesla.batteryPercent))}%` }} />
                {tesla.chargeLimitPercent !== null ? <i style={{ left: `${tesla.chargeLimitPercent}%` }} /> : null}
              </div>
              <p className="ambient-screen__charge-eta">
                {tesla.minutesToFull !== null && tesla.minutesToFull > 0
                  ? `${tesla.minutesToFull >= 60 ? `${Math.floor(tesla.minutesToFull / 60)} h ${tesla.minutesToFull % 60} min` : `${tesla.minutesToFull} min`} restantes`
                  : "Calculando tiempo…"}
                {tesla.rangeKm !== null ? ` · ${tesla.rangeKm} km` : ""}
              </p>
            </div>
          ) : (
            <p className="ambient-screen__tesla">
              <span className="ambient-screen__tesla-battery" style={{ ["--level" as string]: `${tesla.batteryPercent}%` }} aria-hidden />
              {tesla.batteryPercent}%{tesla.rangeKm !== null ? ` · ${tesla.rangeKm} km` : ""} · {chargingLabel(tesla)}
            </p>
          )
        ) : null}

        {current ? (
          <div className="ambient-screen__media" onClick={(event) => event.stopPropagation()}>
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt="" className="ambient-screen__art" />
            ) : (
              <span className="ambient-screen__art ambient-screen__art--empty" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="ambient-screen__media-kind">
                {current.kind === "spotify" ? "Spotify" : current.kind === "radio" ? "Radio" : current.kind === "podcast" ? "Podcast" : "Reproduciendo"}
              </p>
              <p className="ambient-screen__media-title">{current.title}</p>
              {current.subtitle ? <p className="ambient-screen__media-sub">{current.subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="ambient-screen__button"
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                onClick={() => void (isPlaying ? controller?.pause() : controller?.play())}
              >
                {isPlaying ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
              </button>
              <button
                type="button"
                className="ambient-screen__button"
                aria-label="Siguiente"
                onClick={() => void controller?.next()}
              >
                <SkipForward className="size-6 fill-current" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        <div className="ambient-screen__footer">
          <button
            type="button"
            className={cn("ambient-screen__button ambient-screen__button--ai")}
            aria-label="Hablar con TECLA AI"
            onClick={(event) => {
              event.stopPropagation();
              openAssistant({ mode: "voice" });
            }}
          >
            <Mic className="size-5" aria-hidden />
          </button>
          <p className="ambient-screen__hint">Toca la pantalla para volver</p>
        </div>
      </div>
    </div>
  );
}
