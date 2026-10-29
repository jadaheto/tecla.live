"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { bootDuration, bootTitles, buildBootSteps } from "@/features/boot/boot-steps";
import { buildGreeting } from "@/features/ai/greeting";
import { effectivePersona } from "@/features/ai/persona";
import { openAssistant } from "@/features/ai/open-assistant";
import { playSpeech, synthesizeSpeech } from "@/features/ai/announce";
import { useIntegrations, useWeather } from "@/features/integrations/hooks";
import { apiFetch } from "@/lib/http";
import { useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

const SESSION_KEY = "tecla-boot";
const INTRO_KEY = "tecla-style-intro";

interface SpotifyStatusLite {
  configured: boolean;
  connected: boolean;
}

/** Espera a que las preferencias guardadas estén cargadas (persist con skipHydration). */
function usePreferencesHydrated(): boolean {
  return React.useSyncExternalStore(
    (onChange) => usePreferences.persist.onFinishHydration(onChange),
    () => usePreferences.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Arranque «tipo nave»: una vez por sesión, al abrir la app, un chequeo de
 * sistemas con el estado real de clima, TECLA AI, voz, Spotify, YouTube,
 * GPS y audio, en el lenguaje visual del estilo activo. Termina con el
 * briefing (hora, clima, lo pendiente) y, con «Bienvenida por voz» activa,
 * TECLA AI lo pronuncia con la voz configurada (solo síntesis, sin DeepSeek).
 * Si el navegador exige un toque antes de sonar, la cortinilla espera el
 * toque y entonces habla. Tocar la pantalla la cierra.
 */
type WelcomeVoice = "off" | "loading" | "playing" | "blocked" | "done";

export function BootSequence() {
  const pathname = usePathname();
  const hydrated = usePreferencesHydrated();
  const enabled = usePreferences((state) => state.bootSequence);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const aiPersona = usePreferences((state) => state.aiPersona);
  const speakGreeting = usePreferences((state) => state.speakGreeting);
  const bootVoice = usePreferences((state) => state.bootVoice);
  const voiceEnabled = usePreferences((state) => state.voiceEnabled);
  const micConsent = usePreferences((state) => state.micConsent);
  const wakeWordEnabled = usePreferences((state) => state.wakeWordEnabled);
  const [visible, setVisible] = React.useState(false);
  const [phase, setPhase] = React.useState<"running" | "ready" | "closing">("running");
  const [voice, setVoice] = React.useState<WelcomeVoice>("off");
  const voiceRef = React.useRef<WelcomeVoice>("off");
  const pendingAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const autoCloseAtRef = React.useRef(0);
  const integrations = useIntegrations();
  const weather = useWeather();
  const history = useLibrary((state) => state.history);
  const nowPlaying = usePlayer((state) => state.current?.title ?? null);
  const spotifyConfigured = integrations.data?.integrations.spotify ?? false;
  const teslaConfigured = integrations.data?.integrations.tesla ?? false;
  const teslaStatus = useTeslaStatus();
  const teslaVehicle = useTeslaVehicle(visible && teslaConfigured && (teslaStatus.data?.connected ?? false));
  const spotifyStatus = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => apiFetch<SpotifyStatusLite>("/api/spotify/status"),
    enabled: visible && spotifyConfigured,
    staleTime: 30_000,
    retry: 0,
  });

  // Decide una sola vez por sesión, en cuanto se conocen las preferencias.
  React.useEffect(() => {
    if (!hydrated || pathname.startsWith("/remote/")) return;
    const prefs = usePreferences.getState();
    if (!prefs.bootSequence) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
      // La cortinilla de estilo no se repite: el arranque ya va en el lenguaje del estilo.
      sessionStorage.setItem(INTRO_KEY, prefs.visualStyle);
    } catch {
      return;
    }
    setVisible(true);
  }, [hydrated, pathname]);

  const persona = effectivePersona({ aiPersona, visualStyle });
  const elevenLabsReady = integrations.data?.integrations.elevenlabs ?? false;
  // Bienvenida hablada: solo síntesis de voz, sin micrófono ni DeepSeek.
  const welcomeVoice = bootVoice && voiceEnabled && elevenLabsReady;
  // Compatibilidad: sin bienvenida hablada, el «Saludo al iniciar» abre TECLA AI por voz al tocar.
  const voiceBriefing =
    !welcomeVoice && speakGreeting && voiceEnabled && micConsent && elevenLabsReady && (integrations.data?.integrations.deepseek ?? false);

  const steps = React.useMemo(
    () =>
      buildBootSteps({
        integrations: integrations.data ? integrations.data.integrations : null,
        weather: weather.data ? { temperature: weather.data.temperature, label: weather.data.label, location: weather.data.location } : null,
        spotifyLinked: !spotifyConfigured ? false : spotifyStatus.data ? spotifyStatus.data.connected : null,
        secureContext: typeof window !== "undefined" ? window.isSecureContext : true,
        geolocation: typeof navigator !== "undefined" && "geolocation" in navigator,
        nowPlaying,
        wakeWord: wakeWordEnabled,
        tesla: !teslaConfigured
          ? null
          : {
              linked: teslaStatus.data ? teslaStatus.data.connected : null,
              batteryPercent: teslaVehicle.data?.batteryPercent ?? null,
              charging: teslaVehicle.data?.charging === "charging",
              asleep: teslaVehicle.data?.asleep ?? false,
            },
      }),
    [integrations.data, weather.data, spotifyConfigured, spotifyStatus.data, nowPlaying, wakeWordEnabled, teslaConfigured, teslaStatus.data, teslaVehicle.data],
  );

  const briefing = React.useMemo(() => {
    const pending = history.find(
      (entry) => entry.kind === "youtube" && entry.positionSeconds > 30 && entry.durationSeconds > 0 && entry.positionSeconds < entry.durationSeconds * 0.92,
    );
    return buildGreeting({
      hour: new Date().getHours(),
      persona,
      weather: weather.data ? { temperature: weather.data.temperature, label: weather.data.label, location: weather.data.location } : null,
      pendingTitle: pending?.title ?? nowPlaying,
    });
  }, [history, persona, weather.data, nowPlaying]);

  const timing = bootDuration(steps.length, reduceMotion);

  const close = React.useCallback((withVoice: boolean) => {
    setPhase("closing");
    window.setTimeout(() => setVisible(false), 380);
    if (withVoice) openAssistant({ mode: "voice" });
  }, []);

  const setWelcome = React.useCallback((next: WelcomeVoice) => {
    voiceRef.current = next;
    setVoice(next);
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    autoCloseAtRef.current = Date.now() + timing.totalMs;
    const readyTimer = window.setTimeout(() => setPhase("ready"), 500 + steps.length * timing.stepMs);
    const closeTimer = window.setTimeout(() => {
      // Con la voz cargando o bloqueada, la cortinilla espera: la voz cierra al sonar o el toque la libera.
      if (voiceRef.current === "loading" || voiceRef.current === "blocked") return;
      close(false);
    }, timing.totalMs);
    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(closeTimer);
    };
    // La duración queda fijada al mostrarse; los pasos que lleguen después se pintan igual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const briefingRef = React.useRef(briefing);
  React.useEffect(() => {
    briefingRef.current = briefing;
  }, [briefing]);

  // Al terminar el chequeo, sintetiza el briefing una sola vez e intenta pronunciarlo.
  React.useEffect(() => {
    if (phase !== "ready" || !welcomeVoice || voiceRef.current !== "off") return;
    setWelcome("loading");
    void synthesizeSpeech(briefingRef.current).then(async (audio) => {
      if (!audio) {
        setWelcome("done");
        if (Date.now() >= autoCloseAtRef.current) close(false);
        return;
      }
      setWelcome("playing");
      const played = playSpeech(audio);
      // Si el navegador exige un toque, `play()` se rechaza enseguida; si no, la voz ya está sonando.
      const result = await Promise.race([played, new Promise<"pending">((resolve) => window.setTimeout(() => resolve("pending"), 400))]);
      if (result === "blocked") {
        pendingAudioRef.current = audio;
        setWelcome("blocked");
        return;
      }
      if (result === "failed") {
        setWelcome("done");
        if (Date.now() >= autoCloseAtRef.current) close(false);
        return;
      }
      // Sonando: deja ver el briefing un instante y cierra; la voz sigue sobre la app.
      window.setTimeout(() => close(false), Math.max(900, autoCloseAtRef.current - Date.now()));
      void played.then(() => setWelcome("done"));
    });
  }, [phase, welcomeVoice, close, setWelcome]);

  function handleTap() {
    const pending = pendingAudioRef.current;
    if (pending) {
      pendingAudioRef.current = null;
      setWelcome("playing");
      void playSpeech(pending).then(() => setWelcome("done"));
      close(false);
      return;
    }
    close(voiceBriefing);
  }

  if (!visible || !enabled) return null;
  const titles = bootTitles(visualStyle);
  const okCount = steps.filter((step) => step.state === "ok").length;

  return (
    <div
      className={cn("boot-seq", phase === "closing" && "boot-seq--closing")}
      data-style={visualStyle}
      role="status"
      aria-live="polite"
      onClick={handleTap}
    >
      <div className="boot-seq__grid" aria-hidden />
      <div className="boot-seq__stage">
        <p className="boot-seq__eyebrow">{titles.eyebrow}</p>
        <h2 className="boot-seq__title">{phase === "running" ? titles.title : titles.ready}</h2>
        <ol className="boot-seq__list">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="boot-seq__step"
              data-state={step.state}
              style={{ animationDelay: `${500 + index * timing.stepMs}ms` }}
            >
              <span className="boot-seq__dot" aria-hidden />
              <span className="boot-seq__label">{step.label}</span>
              <span className="boot-seq__detail">{step.detail}</span>
              <span className="boot-seq__state">{step.state === "ok" ? "OK" : step.state === "warn" ? "ATN" : "OFF"}</span>
            </li>
          ))}
        </ol>
        <div className="boot-seq__bar" aria-hidden>
          <span style={{ animationDuration: `${500 + steps.length * timing.stepMs}ms` }} />
        </div>
        <p className={cn("boot-seq__briefing", phase !== "running" && "boot-seq__briefing--show")}>{briefing}</p>
        <p className="boot-seq__hint">
          {okCount} de {steps.length} sistemas listos ·{" "}
          {voice === "blocked"
            ? "toca para escuchar la bienvenida"
            : voice === "loading"
              ? "preparando la voz…"
              : voice === "playing"
                ? "hablando…"
                : voiceBriefing
                  ? "toca para escuchar el briefing"
                  : "toca para continuar"}
        </p>
      </div>
    </div>
  );
}
