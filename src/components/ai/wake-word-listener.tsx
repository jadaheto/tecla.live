"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { useAi } from "@/features/ai/store";
import { openAssistant } from "@/features/ai/open-assistant";
import { usePreferences } from "@/stores/preferences";

/** Tipado mínimo del reconocimiento de voz del navegador (prefijo webkit en Chromium). */
interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

// «Oye TECLA», «Hey TECLA», «Hola TECLA», «OK TECLA»; tolera «tekla», «tecla live» y «tesla».
const WAKE_PATTERN = /\b(oye|hey|ok|okey|hola|ey)[,\s]+(tecla|tekla|tesla)\b/i;

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
 */
export function WakeWordListener() {
  const enabled = usePreferences((state) => state.wakeWordEnabled);
  const assistantName = usePreferences((state) => state.aiName);
  const status = useAi((state) => state.status);
  const voiceOpen = useAi((state) => state.voiceOpen);
  const panelOpen = useAi((state) => state.panelOpen);
  const [active, setActive] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);

  const supported = React.useSyncExternalStore(
    () => () => undefined,
    () => getRecognitionCtor() !== null,
    () => true,
  );
  const unsupported = !supported || blocked;
  const recognitionRef = React.useRef<RecognitionLike | null>(null);
  const shouldRun = enabled && status === "idle" && !voiceOpen && !panelOpen;

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

    const scheduleRestart = (delay: number) => {
      if (disposed) return;
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(start, delay);
    };

    function start() {
      if (disposed || running || document.hidden) return;
      try {
        recognition = new Recognition();
        recognition.lang = "es-CO";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const item = event.results[i];
            const transcript = (item?.[0]?.transcript ?? "").trim();
            const custom = assistantName.trim().toLowerCase();
            const customHit =
              custom && custom !== "tecla"
                ? new RegExp(`\\b(oye|hey|ok|okey|hola|ey)[,\\s]+${custom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(transcript)
                : false;
            if (WAKE_PATTERN.test(transcript) || customHit) {
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
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            disposed = true;
            setBlocked(true);
            setActive(false);
          }
          // "no-speech", "network", "aborted" y "audio-capture" se resuelven reiniciando en onend.
        };
        recognition.onend = () => {
          running = false;
          recognitionRef.current = null;
          setActive(false);
          scheduleRestart(700);
        };
        recognition.start();
        running = true;
        recognitionRef.current = recognition;
        setActive(true);
      } catch {
        running = false;
        setBlocked(true);
      }
    }
    start();
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
      if (restartTimer !== null) window.clearTimeout(restartTimer);
      recognition?.abort();
      recognitionRef.current = null;
      setActive(false);
    };
  }, [shouldRun, assistantName]);

  if (!enabled) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[88px] z-[60] -translate-x-1/2 rounded-full border border-border bg-[var(--glass-strong)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted shadow-lg backdrop-blur-xl md:top-[96px]"
    >
      <span className="flex items-center gap-2">
        <Mic className={active ? "size-3 text-emerald-400" : "size-3 text-muted"} aria-hidden />
        {unsupported ? "«Oye TECLA» no disponible en este navegador" : active ? "«Oye TECLA» escuchando" : "«Oye TECLA» en pausa"}
      </span>
    </div>
  );
}
