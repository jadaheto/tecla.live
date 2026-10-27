"use client";

import * as React from "react";
import { Keyboard, Mic, Square, X } from "lucide-react";
import { Waveform } from "@/components/ai/visualizer";
import { SiriOrb } from "@/components/ai/siri-orb";
import { KittVoiceBox } from "@/components/kitt/kitt-voice-box";
import { RoadsterReticle } from "@/components/roadster/roadster-reticle";
import { effectivePersona } from "@/features/ai/persona";
import { useAi } from "@/features/ai/store";
import { useTeclaAI } from "@/features/ai/hooks/use-tecla-ai";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";
import { useWeather } from "@/features/integrations/hooks";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { buildGreeting } from "@/features/ai/greeting";
import { cn } from "@/lib/utils";

const CLOSE_AFTER_REPLY_MS = 4_000;
const CLOSE_AFTER_ERROR_MS = 6_000;

function hudLabel(status: string, persona: "jarvis" | "copiloto" | "kitt" | "piloto" | "computadora"): string {
  switch (status) {
    case "listening":
      return persona === "computadora"
        ? "Escuchando, capitán."
        : persona === "piloto"
        ? "A la escucha, piloto."
        : persona === "kitt"
          ? "Le escucho, señor. Escáner activo."
          : persona === "jarvis"
            ? "Le escucho, señor."
            : "Te escucho…";
    case "transcribing":
      return "Entendiendo…";
    case "thinking":
      return "Procesando…";
    case "executing":
      return "Ejecutando…";
    case "speaking":
      return persona === "copiloto" ? "Respondiendo…" : "Respondiendo.";
    case "error":
      return "No pude completar la orden.";
    default:
      return "Toca el indicador para hablar.";
  }
}

/**
 * TECLA AI solo voz: un HUD flotante sin teclado, como el asistente del
 * Tesla. Escucha al abrirse, muestra lo que entendió y la respuesta, y se
 * cierra solo al terminar. «Escribir» abre el panel de texto completo.
 */
export function VoiceHud({ open, onClose, onOpenText }: { open: boolean; onClose: () => void; onOpenText: () => void }) {
  const { messages, status, error, busy, startListening, stopListening, stop, speak, canListen, voiceInputAvailable, voiceOutputAvailable } = useTeclaAI();
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;
  const micConsent = usePreferences((state) => state.micConsent);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const aiPersona = usePreferences((state) => state.aiPersona);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const persona = effectivePersona({ aiPersona, visualStyle });
  const assistantName = usePreferences((state) => state.aiName);
  const conversationMode = usePreferences((state) => state.conversationMode);
  const speakGreeting = usePreferences((state) => state.speakGreeting);
  const voiceEnabled = usePreferences((state) => state.voiceEnabled);
  const weather = useWeather();
  const history = useLibrary((state) => state.history);
  const startedRef = React.useRef(false);
  const workedRef = React.useRef(false);
  // Marca de apertura (la fija el store al abrir): solo se muestran mensajes posteriores.
  const openedAt = useAi((state) => state.voiceOpenedAt);
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const showAssistant =
    lastAssistant && lastUser && new Date(lastAssistant.createdAt).getTime() >= openedAt;
  const showUser = lastUser && new Date(lastUser.createdAt).getTime() >= openedAt;
  const voiceReady = canListen && voiceInputAvailable && configured;

  // Escucha de inmediato al abrir (dentro de la activación del toque).
  React.useEffect(() => {
    if (!open) {
      startedRef.current = false;
      workedRef.current = false;
      return;
    }
    if (startedRef.current || !micConsent || !voiceReady || busy || status !== "idle") return;
    startedRef.current = true;
    // Rutina de arranque: una vez por sesión, Jarvis saluda y luego escucha.
    let greeted = false;
    try {
      greeted = sessionStorage.getItem("tecla-greeted") === "1";
    } catch {
      greeted = true;
    }
    const shouldGreet = speakGreeting && voiceEnabled && voiceOutputAvailable && !greeted;
    const timer = window.setTimeout(() => {
      if (!shouldGreet) {
        void startListening();
        return;
      }
      try {
        sessionStorage.setItem("tecla-greeted", "1");
      } catch {
        // Sin sessionStorage el saludo se repite; aceptable.
      }
      const pending = history.find((entry) => entry.kind === "youtube" && (entry.positionSeconds ?? 0) > 30 && (entry.durationSeconds ?? 0) > 0 && (entry.positionSeconds ?? 0) < (entry.durationSeconds ?? 0) * 0.92);
      const text = buildGreeting({
        hour: new Date().getHours(),
        persona,
        weather: weather.data ? { temperature: weather.data.temperature, label: weather.data.label, location: weather.data.location } : null,
        pendingTitle: pending?.title ?? usePlayer.getState().current?.title ?? null,
      });
      void speak(text).finally(() => void startListening());
    }, 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, micConsent, voiceReady]);

  // Cierre automático tras responder (o tras un error), salvo en modo conversación.
  React.useEffect(() => {
    if (!open) return;
    if (status === "thinking" || status === "executing" || status === "speaking" || status === "transcribing") {
      workedRef.current = true;
      return;
    }
    if (status === "listening") return;
    if (!workedRef.current && status !== "error") return;
    if (conversationMode && status !== "error") return;
    const timer = window.setTimeout(onClose, status === "error" ? CLOSE_AFTER_ERROR_MS : CLOSE_AFTER_REPLY_MS);
    return () => window.clearTimeout(timer);
  }, [open, status, conversationMode, onClose]);

  if (!open) return null;

  const listening = status === "listening";

  return (
    <div
      role="dialog"
      aria-label="TECLA AI por voz"
      className="fixed inset-x-3 bottom-[96px] z-[95] mx-auto max-w-[620px] sm:bottom-8"
    >
      <p className="mb-1 ml-5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted/70">{assistantName}</p>
      <div className="glass-strong flex items-center gap-4 rounded-[1.8rem] border px-4 py-3 shadow-[var(--shadow-float)] sm:px-5">
        <button
          type="button"
          onClick={() => {
            if (listening) {
              stopListening();
              return;
            }
            if (busy) {
              stop();
              return;
            }
            if (!micConsent) {
              setPreferences({ micConsent: true });
              useAi.getState().setError(null);
            }
            void startListening();
          }}
          aria-label={listening ? "Terminar de hablar y enviar" : busy ? "Detener" : "Hablar con TECLA AI"}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
            listening && "scale-105",
          )}
        >
          {visualStyle === "kitt" ? (
            <KittVoiceBox status={status} />
          ) : visualStyle === "roadster" ? (
            <RoadsterReticle status={status} size={92} />
          ) : (
            <SiriOrb status={status} size={92} />
          )}
          {listening ? (
            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-red-500 text-white shadow">
              <Mic className="size-3.5" aria-hidden />
            </span>
          ) : busy ? (
            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-white shadow">
              <Square className="size-3 fill-current" aria-hidden />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Waveform active={listening || busy} bars={9} />
            <p className="text-[13px] font-semibold tracking-tight">
              {!voiceReady
                ? "La voz no está disponible en este navegador."
                : !micConsent
                  ? "Toca el indicador para permitir el micrófono."
                  : hudLabel(status, persona)}
            </p>
          </div>
          {showUser ? (
            <p className="mt-1 line-clamp-1 text-[12px] text-muted">«{lastUser.content}»</p>
          ) : null}
          {showAssistant ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-foreground/90">{lastAssistant.content}</p>
          ) : null}
          {error ? <p className="mt-1 line-clamp-2 text-[12px] text-red-400">{error}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={onOpenText}
            aria-label="Escribir en TECLA AI"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted"
          >
            <Keyboard className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose();
            }}
            aria-label="Cerrar TECLA AI"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
