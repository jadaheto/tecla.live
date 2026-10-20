"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Loader2, Mic, Settings2, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Waveform } from "@/components/ai/visualizer";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";
import { useAi } from "@/features/ai/store";
import type { AiVisualState } from "@/types";
import { cn } from "@/lib/utils";

export function AiComposer({
  onSend,
  onStop,
  onStartListening,
  onStopListening,
  busy,
  status,
  canListen,
  voiceInputAvailable,
  autoFocus = false,
  compact = false,
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  onStartListening: () => void | Promise<void>;
  onStopListening: () => void;
  busy: boolean;
  status: AiVisualState;
  canListen: boolean;
  voiceInputAvailable: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [consentOpen, setConsentOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;
  const micConsent = usePreferences((state) => state.micConsent);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const listening = status === "listening";
  const transcribing = status === "transcribing";
  const voiceReady = voiceInputAvailable && canListen;

  React.useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => textareaRef.current?.focus(), 220);
    }
  }, [autoFocus]);

  React.useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [value]);

  function submit() {
    const clean = value.trim();
    if (!clean || busy || !configured) return;
    onSend(clean);
    setValue("");
  }

  function handleMic() {
    if (listening) {
      onStopListening();
      return;
    }
    if (busy) return;
    if (!voiceReady) return;
    if (!micConsent) {
      setConsentOpen(true);
      return;
    }
    void onStartListening();
  }

  function acceptConsent() {
    setPreferences({ micConsent: true });
    setConsentOpen(false);
    useAi.getState().setError(null);
    void onStartListening();
  }

  return (
    <div className="border-t border-border bg-[var(--header)] p-3 backdrop-blur-xl sm:p-4">
      {consentOpen && !listening ? (
        <div className="mb-2.5 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Mic className="size-4 text-accent" aria-hidden />
            Permiso de micrófono
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            TECLA AI graba solo mientras el botón esté activo. El audio se envía a Deepgram
            para transcribirlo y no se guarda en TECLA LIVE. Puedes cancelar con el botón de detener.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={acceptConsent}>
              Permitir micrófono
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConsentOpen(false)}
            >
              Ahora no
            </Button>
          </div>
        </div>
      ) : null}

      {listening ? (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
          <Waveform active bars={9} />
          <p className="flex-1 text-[11px] text-muted">
            Escuchando… toca el micrófono para transcribir y enviar.
          </p>
          <button
            type="button"
            onClick={onStopListening}
            className="flex min-h-8 items-center gap-1.5 rounded-full bg-red-500/15 px-3 text-[11px] font-medium text-red-400"
          >
            <Square className="size-3 fill-current" aria-hidden />
            Enviar
          </button>
        </div>
      ) : null}

      <div className="rounded-[1.4rem] border border-border bg-surface p-2 transition-colors focus-within:border-accent/35">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={
            listening
              ? "Escuchando…"
              : configured
                ? "Pide algo o escribe una orden…"
                : "TECLA AI pendiente de configuración"
          }
          aria-label="Mensaje para TECLA AI"
          className={cn(
            "max-h-[132px] min-h-10 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0",
            compact && "text-[13px]",
          )}
          disabled={!configured || listening}
        />
        <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-1">
          <span className="ml-1 flex-1 text-[10px] text-muted">
            {listening
              ? "El audio se borra después de transcribir"
              : configured
                ? "Enter envía · Shift+Enter salto de línea"
                : "Modo manual disponible"}
          </span>

          <Button
            type="button"
            variant={listening ? "danger" : "ghost"}
            size="icon"
            onClick={handleMic}
            disabled={!configured || !voiceReady || (busy && !listening) || transcribing}
            aria-label={listening ? "Detener grabación y enviar" : "Hablar con TECLA AI"}
            aria-pressed={listening}
            title={
              !voiceInputAvailable
                ? "La voz de entrada no está configurada"
                : !canListen
                  ? "Este navegador no ofrece micrófono compatible"
                  : listening
                    ? "Detener y enviar"
                    : "Pulsar para hablar"
            }
            className={cn(
              "size-9",
              listening && "animate-pulse shadow-[0_0_24px_rgba(239,68,68,0.4)]",
            )}
          >
            {transcribing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mic className="size-4" aria-hidden />
            )}
          </Button>

          {status === "speaking" ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onStop}
              aria-label="Detener la voz"
              className="size-9"
              title="Detener la voz"
            >
              <Volume2 className="size-4" aria-hidden />
            </Button>
          ) : null}

          {busy && !listening ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onStop}
              aria-label="Detener a TECLA AI"
              className="size-9"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="icon"
              onClick={submit}
              disabled={!value.trim() || !configured || listening}
              aria-label="Enviar mensaje"
              className="size-9"
            >
              {integrations.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          )}
        </div>
      </div>

      {!configured && !integrations.isLoading ? (
        <Link
          href="/settings"
          className="mt-2.5 flex min-h-9 items-center justify-center gap-1.5 rounded-full text-[10px] font-medium text-muted transition-colors hover:text-foreground"
        >
          <Settings2 className="size-3" aria-hidden />
          Configurar DeepSeek para conversar
        </Link>
      ) : !voiceInputAvailable && !integrations.isLoading ? (
        <p className="mt-2 text-center text-[9px] leading-relaxed text-muted/60">
          Entrada de voz no configurada. La conversación por texto sigue disponible.
        </p>
      ) : (
        <p className="mt-2 text-center text-[9px] leading-relaxed text-muted/60">
          TECLA AI puede equivocarse. Las acciones sensibles requieren confirmación del navegador.
        </p>
      )}
    </div>
  );
}
