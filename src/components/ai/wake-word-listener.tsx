"use client";

import * as React from "react";
import { Mic, MicOff } from "lucide-react";
import { useAi } from "@/features/ai/store";
import { openAssistant } from "@/features/ai/open-assistant";
import { matchesWakeWord } from "@/features/ai/wake-word";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

/** Tipado mínimo del reconocimiento de voz del navegador (prefijo webkit en Chromium). */
interface RecognitionAlternativeLike {
  transcript: string;
}
interface RecognitionResultLike {
  isFinal: boolean;
  length?: number;
  [index: number]: RecognitionAlternativeLike | undefined;
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onstart?: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

type WakeStatus = "listening" | "paused" | "reconnecting" | "offline" | "blocked" | "unsupported";

const LANGS = ["es-CO", "es-419", "es-ES"];
const RESTART_DELAY_MS = 700;
const MAX_BACKOFF_MS = 30_000;
const WATCHDOG_INTERVAL_MS = 15_000;
const WATCHDOG_STALL_MS = 45_000;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * Palabra de activación «Oye TECLA». Solo corre con la preferencia activada
 * (consentimiento explícito), muestra un indicador visible mientras escucha,
 * se detiene mientras TECLA AI está escuchando o hablando y se apaga al
 * ocultar la pestaña. Usa el reconocimiento del navegador; el audio no pasa
 * por los servidores de TECLA LIVE.
 *
 * Pensado para el navegador del Tesla: revisa todas las alternativas del
 * reconocedor, tolera variantes fonéticas, reinicia con espera creciente si
 * el servicio de voz falla, vigila que el reconocedor no se quede mudo y, si
 * el permiso del micrófono se negó, ofrece activarlo con un toque.
 */
export function WakeWordListener() {
  const enabled = usePreferences((state) => state.wakeWordEnabled);
  const assistantName = usePreferences((state) => state.aiName);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const status = useAi((state) => state.status);
  const voiceOpen = useAi((state) => state.voiceOpen);
  const panelOpen = useAi((state) => state.panelOpen);
  const [wakeStatus, setWakeStatus] = React.useState<WakeStatus>("paused");
  const [retryKey, setRetryKey] = React.useState(0);

  const supported = React.useSyncExternalStore(
    () => () => undefined,
    () => getRecognitionCtor() !== null,
    () => true,
  );
  const recognitionRef = React.useRef<RecognitionLike | null>(null);
  const shouldRun = enabled && supported && status === "idle" && !voiceOpen && !panelOpen;

  React.useEffect(() => {
    if (!shouldRun) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const Recognition: RecognitionCtor = Ctor;
    let disposed = false;
    let recognition: RecognitionLike | null = null;
    let restartTimer: number | null = null;
    let running = false;
    let errorStreak = 0;
    let langIndex = 0;
    let lastEventAt = Date.now();

    const scheduleRestart = (delay: number) => {
      if (disposed) return;
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(start, delay);
    };

    const backoff = () => Math.min(MAX_BACKOFF_MS, RESTART_DELAY_MS * 2 ** errorStreak);

    function start() {
      if (disposed || running || document.hidden) return;
      try {
        recognition = new Recognition();
        recognition.lang = LANGS[langIndex] ?? "es-CO";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.onstart = () => {
          lastEventAt = Date.now();
        };
        recognition.onresult = (event) => {
          lastEventAt = Date.now();
          errorStreak = 0;
          setWakeStatus((current) => (current === "listening" ? current : "listening"));
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const item = event.results[i];
            if (!item) continue;
            const alternatives = Math.max(1, item.length ?? 1);
            for (let alt = 0; alt < alternatives; alt += 1) {
              const transcript = item[alt]?.transcript ?? "";
              if (!transcript || !matchesWakeWord(transcript, { assistantName, style: visualStyle })) continue;
              disposed = true;
              running = false;
              recognition?.abort();
              recognitionRef.current = null;
              openAssistant({ mode: "voice" });
              return;
            }
          }
        };
        recognition.onerror = (event) => {
          lastEventAt = Date.now();
          const code = event.error ?? "";
          if (code === "not-allowed" || code === "service-not-allowed") {
            disposed = true;
            setWakeStatus("blocked");
            return;
          }
          if (code === "language-not-supported") {
            langIndex = Math.min(LANGS.length - 1, langIndex + 1);
            return;
          }
          if (code === "network" || code === "audio-capture") {
            errorStreak += 1;
            setWakeStatus(errorStreak >= 3 ? "offline" : "reconnecting");
          }
          // "no-speech" y "aborted" son normales: se reinicia en onend.
        };
        recognition.onend = () => {
          running = false;
          recognitionRef.current = null;
          if (disposed) return;
          setWakeStatus((current) => (current === "listening" ? "paused" : current));
          scheduleRestart(errorStreak === 0 ? RESTART_DELAY_MS : backoff());
        };
        recognition.start();
        running = true;
        lastEventAt = Date.now();
        recognitionRef.current = recognition;
        setWakeStatus("listening");
      } catch {
        running = false;
        errorStreak += 1;
        setWakeStatus(errorStreak >= 3 ? "offline" : "reconnecting");
        scheduleRestart(backoff());
      }
    }
    start();

    // Vigilante: si el reconocedor lleva demasiado sin emitir nada, se reinicia.
    const watchdog = window.setInterval(() => {
      if (disposed || !running) return;
      if (Date.now() - lastEventAt > WATCHDOG_STALL_MS) recognition?.abort();
    }, WATCHDOG_INTERVAL_MS);

    const onVisibility = () => {
      if (document.hidden) {
        recognition?.abort();
      } else {
        scheduleRestart(300);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(watchdog);
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      recognition?.abort();
      recognitionRef.current = null;
      setWakeStatus((current) => (current === "blocked" ? current : "paused"));
    };
  }, [shouldRun, assistantName, visualStyle, retryKey]);

  // Con el permiso negado, un toque (gesto del usuario) vuelve a pedir el micrófono y reintenta.
  async function unblock() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      return;
    }
    setWakeStatus("paused");
    setRetryKey((value) => value + 1);
  }

  if (!enabled) return null;
  const effective: WakeStatus = !supported ? "unsupported" : wakeStatus;
  const label =
    effective === "unsupported"
      ? "«Oye TECLA» no disponible en este navegador"
      : effective === "blocked"
        ? "Toca para activar «Oye TECLA»"
        : effective === "offline"
          ? "«Oye TECLA» sin servicio de voz · reintentando"
          : effective === "reconnecting"
            ? "«Oye TECLA» reconectando"
            : effective === "listening"
              ? "«Oye TECLA» escuchando"
              : "«Oye TECLA» en pausa";
  const className =
    "fixed left-1/2 top-[88px] z-[60] -translate-x-1/2 rounded-full border border-border bg-[var(--glass-strong)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted shadow-lg backdrop-blur-xl md:top-[96px]";
  const icon =
    effective === "listening" ? (
      <Mic className="size-3 text-emerald-400" aria-hidden />
    ) : effective === "blocked" || effective === "unsupported" ? (
      <MicOff className="size-3 text-red-400" aria-hidden />
    ) : (
      <Mic className={cn("size-3", effective === "offline" ? "text-amber-400" : "text-muted")} aria-hidden />
    );

  if (effective === "blocked") {
    return (
      <button type="button" onClick={() => void unblock()} className={cn(className, "min-h-9 text-foreground")}>
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </button>
    );
  }
  return (
    <div role="status" aria-live="polite" className={cn(className, "pointer-events-none")}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
    </div>
  );
}
