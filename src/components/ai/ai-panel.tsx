"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { Maximize2, Settings2, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { AiComposer } from "@/components/ai/ai-composer";
import { AiMessageList } from "@/components/ai/ai-messages";
import { AiOrb, statusColor, statusLabel, Waveform } from "@/components/ai/visualizer";
import { useAi } from "@/features/ai/store";
import { useTeclaAI } from "@/features/ai/hooks/use-tecla-ai";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";

export function AiPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const {
    messages,
    status,
    error,
    busy,
    send,
    speak,
    stop,
    clear,
    startListening,
    stopListening,
    canListen,
    voiceInputAvailable,
    voiceOutputAvailable,
  } = useTeclaAI();
  const pendingPrompt = useAi((state) => state.pendingPrompt);
  const setPendingPrompt = useAi((state) => state.setPendingPrompt);
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;
  const muted = integrations.data;
  const voiceEnabled = usePreferences((state) => state.voiceEnabled);
  const setPreferences = usePreferences((state) => state.setPreferences);

  React.useEffect(() => {
    if (!open || !pendingPrompt || busy) return;
    setPendingPrompt(null);
    void send(pendingPrompt);
  }, [busy, open, pendingPrompt, send, setPendingPrompt]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-md data-[state=open]:animate-[fade-up_.25s_ease-out]" />
        <DialogPrimitive.Content className="ai-panel fixed inset-x-0 bottom-0 top-auto z-[100] flex h-[92dvh] flex-col overflow-hidden rounded-t-[2rem] border border-border bg-background shadow-[var(--shadow-float)] outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:w-[490px] sm:rounded-none sm:border-y-0 sm:border-r-0">
          <DialogPrimitive.Title className="sr-only">TECLA AI</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Copiloto conversacional de TECLA LIVE. Puedes escribir órdenes o usar el micrófono cuando esté disponible.
          </DialogPrimitive.Description>

          <header className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
            <div className="sm:hidden absolute inset-x-0 top-1.5 flex justify-center">
              <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
            </div>
            <AiOrb size="sm" pulse={false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold tracking-tight">TECLA AI</p>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[9px] font-medium text-muted">
                  <span className={`size-1.5 rounded-full ${statusColor(status)}`} aria-hidden />
                  {statusLabel(status)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Waveform active={busy || status === "speaking"} bars={7} />
                <span className="text-[10px] text-muted">
                  {muted?.integrations.deepseek ? "DeepSeek conectado" : "Integración pendiente"}
                  {muted?.integrations.elevenlabs ? " · voz activa" : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPreferences({ voiceEnabled: !voiceEnabled })}
                aria-label={voiceEnabled ? "Silenciar respuestas de voz" : "Activar respuestas de voz"}
                aria-pressed={voiceEnabled}
                title={voiceEnabled ? "Silenciar respuestas de voz" : "Activar respuestas de voz"}
                className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Borrar conversación"
                  title="Borrar conversación"
                  className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              <Link
                href="/ai"
                onClick={() => onOpenChange(false)}
                aria-label="Abrir TECLA AI en pantalla completa"
                title="Pantalla completa"
                className="hidden size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground sm:flex"
              >
                <Maximize2 className="size-4" />
              </Link>
              <DialogPrimitive.Close
                aria-label="Cerrar TECLA AI"
                className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="size-4.5" />
              </DialogPrimitive.Close>
            </div>
          </header>

          <AiMessageList
            messages={messages}
            status={status}
            error={error}
            onSuggestion={(prompt) => void send(prompt)}
            onSpeak={(text) => void speak(text)}
            voiceOutputAvailable={voiceOutputAvailable && voiceEnabled}
          />

          <AiComposer
            onSend={(message) => void send(message)}
            onStop={stop}
            onStartListening={startListening}
            onStopListening={stopListening}
            busy={busy}
            status={status}
            canListen={canListen}
            voiceInputAvailable={voiceInputAvailable}
            autoFocus={open}
          />

          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[9px] text-muted/60">
            <span>Privado por defecto · sin guardar transcripciones</span>
            {!configured && !integrations.isLoading ? (
              <Link href="/settings" className="flex items-center gap-1 hover:text-foreground">
                <Settings2 className="size-3" aria-hidden />
                Ajustes
              </Link>
            ) : (
              <span>⌘J</span>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
