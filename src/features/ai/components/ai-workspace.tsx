"use client";

import * as React from "react";
import Link from "next/link";
import {
  CircleCheck,
  Info,
  Mic,
  MicOff,
  Monitor,
  Settings2,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AiComposer } from "@/components/ai/ai-composer";
import { AiMessageList } from "@/components/ai/ai-messages";
import { AiOrb, statusColor, statusLabel, Waveform } from "@/components/ai/visualizer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAi } from "@/features/ai/store";
import { useTeclaAI, screenLabel } from "@/features/ai/hooks/use-tecla-ai";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePathname } from "next/navigation";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Pon música para el camino.",
  "Busca videos de tecnología en YouTube.",
  "¿Qué temperatura hace en Sincelejo?",
  "Activa el modo cine.",
  "¿Qué estaba viendo?",
];

export function AiWorkspace() {
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
  const pathname = usePathname();
  const pendingPrompt = useAi((state) => state.pendingPrompt);
  const setPendingPrompt = useAi((state) => state.setPendingPrompt);
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;
  const current = usePlayer((state) => state.current);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const voiceEnabled = usePreferences((state) => state.voiceEnabled);
  const conversationMode = usePreferences((state) => state.conversationMode);
  const setPreferences = usePreferences((state) => state.setPreferences);

  React.useEffect(() => {
    useAi.getState().setPanelOpen(true);
    return () => useAi.getState().setPanelOpen(false);
  }, []);

  React.useEffect(() => {
    if (!pendingPrompt || busy || !configured) return;
    setPendingPrompt(null);
    void send(pendingPrompt);
  }, [busy, configured, pendingPrompt, send, setPendingPrompt]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-5">
        <div>
          <p className="eyebrow mb-1.5 flex items-center gap-1.5">
            <Sparkles className="size-3 text-accent" aria-hidden />
            Copiloto conversacional
          </p>
          <h1 className="text-display text-[2rem] sm:text-[2.6rem]">TECLA AI</h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
            Habla o escribe. TECLA AI entiende tu pantalla, busca contenido real y opera solo
            las funciones que le autorizas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[11px] text-muted">
            <span className={cn("size-1.5 rounded-full", statusColor(status))} aria-hidden />
            {statusLabel(status)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreferences({ voiceEnabled: !voiceEnabled })}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            {voiceEnabled ? "Voz activa" : "Voz silenciada"}
          </Button>
          {messages.length > 0 ? (
            <Button variant="subtle" size="sm" onClick={clear}>
              <Trash2 className="size-4" aria-hidden />
              Borrar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-label="Conversación con TECLA AI"
          className="relative flex h-[calc(100dvh-245px)] min-h-[500px] flex-col overflow-hidden rounded-[2rem] border border-border bg-background/70 shadow-[var(--shadow-float)] backdrop-blur-xl xl:h-[calc(100dvh-260px)]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-accent/[0.07] to-transparent" />
          <header className="relative flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <AiOrb size="sm" pulse={false} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Sesión actual</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                <Waveform active={busy || status === "speaking"} bars={7} />
                {configured ? "DeepSeek conectado" : "DeepSeek pendiente"}
                {voiceInputAvailable ? " · micrófono listo" : " · voz no configurada"}
                {conversationMode ? " · modo conversación" : ""}
              </div>
            </div>
            <Link
              href="/settings"
              className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-muted transition-colors hover:text-foreground"
            >
              <Settings2 className="size-3.5" aria-hidden />
              Ajustes
            </Link>
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
            autoFocus
          />
        </section>

        <aside className="hidden min-w-0 flex-col gap-4 xl:flex">
          <Card className="p-5">
            <p className="eyebrow mb-3">Contexto actual</p>
            <ul className="space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <Monitor className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span>
                  <span className="block text-muted">Pantalla</span>
                  <span className="font-medium">{screenLabel(pathname)}</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                {current ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block text-muted">Reproductor</span>
                  {current ? (
                    <>
                      <span className="line-clamp-2 font-medium">{current.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted">
                        {isPlaying ? "Reproduciendo" : "Pausado"}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium">Sin reproducción activa</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                {voiceInputAvailable ? (
                  <Mic className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <MicOff className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                )}
                <span>
                  <span className="block text-muted">Micrófono</span>
                  <span className="font-medium">
                    {voiceInputAvailable
                      ? "Push-to-talk · Deepgram"
                      : "Escribe tu orden; voz no configurada"}
                  </span>
                </span>
              </li>
            </ul>
            {current ? (
              <Link
                href={current.href ?? (current.kind === "youtube" ? `/watch/${current.id}` : current.kind === "spotify" ? "/music" : "/radio")}
                className="mt-4 flex min-h-10 items-center justify-center rounded-xl border border-border text-[11px] font-medium text-muted transition-colors hover:text-foreground"
              >
                Volver al reproductor
              </Link>
            ) : null}
          </Card>

          <Card className="p-5">
            <p className="eyebrow mb-3">Prueba pedir</p>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={!configured}
                  onClick={() => void send(prompt)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-transparent px-2.5 text-left text-[11px] text-muted transition-colors hover:border-border hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="size-3 shrink-0 text-accent" aria-hidden />
                  {prompt}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="eyebrow mb-2">Privacidad</p>
            <p className="text-[11px] leading-relaxed text-muted">
              La conversación vive en esta pestaña y se borra al recargar. No guardamos audio ni
              transcripciones. El micrófono solo se activa cuando tú lo pides.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[11px] font-medium text-foreground"
            >
              Revisar privacidad
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
