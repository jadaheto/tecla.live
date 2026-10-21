"use client";

import * as React from "react";
import Link from "next/link";
import {
  CircleCheck,
  Monitor,
  Radio,
  Settings2,
  Sparkles,
  TriangleAlert,
  TvMinimalPlay,
  Volume2,
} from "lucide-react";
import { SiriOrb } from "@/components/ai/siri-orb";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";
import type { AiChatMessage, AiVisualState } from "@/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { label: "Pon música de Coldplay", prompt: "Pon música de Coldplay.", icon: Radio },
  { label: "Busca un video de tecnología", prompt: "Busca videos de tecnología.", icon: TvMinimalPlay },
  { label: "¿Qué clima hace en Sincelejo?", prompt: "¿Qué temperatura hace en Sincelejo?", icon: Sparkles },
  { label: "Modo cine", prompt: "Activa el modo cine.", icon: Monitor },
  { label: "Estilo Cyberpunk 2077", prompt: "Activa el estilo Cyberpunk 2077.", icon: Sparkles },
];

export function AiMessageList({
  messages,
  status,
  error,
  onSuggestion,
  onSpeak,
  voiceOutputAvailable = false,
}: {
  messages: AiChatMessage[];
  status: AiVisualState;
  error: string | null;
  onSuggestion: (prompt: string) => void;
  onSpeak?: (text: string) => void;
  voiceOutputAvailable?: boolean;
}) {
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;
  const persona = usePreferences((state) => state.aiPersona);
  const jarvis = persona === "jarvis";
  const endRef = React.useRef<HTMLDivElement>(null);
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  React.useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, status, error]);

  const waiting =
    (status === "thinking" || status === "executing") &&
    messages[messages.length - 1]?.role === "user";

  return (
    <div className="ai-scroll flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
      {messages.length === 0 ? (
        <div className="flex min-h-full flex-col justify-center py-6">
          <div className="flex flex-col items-center text-center">
            <SiriOrb status={status} size={112} className="mb-5" />
            <p className="eyebrow mb-2">{jarvis ? "Sistemas en línea" : "Tu copiloto"}</p>
            <h2 className="text-display text-2xl text-balance">
              {jarvis ? "A sus órdenes, señor." : "¿Qué quieres disfrutar hoy?"}
            </h2>
            <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted">
              {jarvis
                ? "Música, video, rutas, clima o el estilo de la pantalla. Ejecuto y reporto; usted decide qué se reproduce y qué se guarda."
                : "Pide un video, música, una ruta o el clima. Tú decides qué se reproduce y qué se guarda."}
            </p>
          </div>

          <div className="mt-6 grid gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => onSuggestion(suggestion.prompt)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-surface/60 px-3.5 text-left text-[13px] text-foreground/90 transition-colors hover:border-accent/30 hover:bg-surface"
              >
                <suggestion.icon className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="flex-1">{suggestion.label}</span>
                <span className="text-[10px] text-muted">Probar</span>
              </button>
            ))}
          </div>

          {!integrations.isLoading && !configured ? (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-4" aria-hidden />
                DeepSeek todavía no está configurado
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Añade <code className="font-mono">DEEPSEEK_API_KEY</code> para activar la
                conversación. Mientras tanto, todos los controles táctiles siguen disponibles.
              </p>
              <Link
                href="/settings"
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-medium text-foreground"
              >
                <Settings2 className="size-3.5" aria-hidden />
                Ver configuración
              </Link>
            </div>
          ) : null}

          <p className="mt-5 text-center text-[10px] leading-relaxed text-muted/70">
            Los mensajes viven solo en esta sesión del navegador. No guardamos audio ni
            transcripciones.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2.5",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {message.role === "assistant" ? (
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] text-white">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
              ) : null}

              <div
                className={cn(
                  "max-w-[85%] space-y-2",
                  message.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed",
                    message.role === "user"
                      ? "rounded-br-md bg-accent text-accent-foreground"
                      : "rounded-bl-md border border-border bg-surface text-foreground",
                  )}
                >
                  {message.content}
                </div>

                {message.id === lastAssistantId &&
                voiceOutputAvailable &&
                onSpeak &&
                message.content ? (
                  <button
                    type="button"
                    onClick={() => onSpeak(message.content)}
                    className="flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-[10px] font-medium text-muted transition-colors hover:text-foreground"
                  >
                    <Volume2 className="size-3" aria-hidden />
                    Escuchar respuesta
                  </button>
                ) : null}

                {message.actions?.length ? (
                  <ul className="space-y-1.5 rounded-2xl border border-border bg-surface/40 p-2.5">
                    {message.actions.map((action, index) => (
                      <li
                        key={`${action.name}-${index}`}
                        className="flex items-start gap-2 text-[11px] leading-snug"
                      >
                        {action.status === "ok" ? (
                          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden />
                        ) : (
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
                        )}
                        <span className="text-muted">{action.summary}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {waiting ? (
            <div className="flex gap-2.5">
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] text-white">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
                <span className="typing-dot size-1.5 rounded-full bg-muted" />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/5 p-3 text-xs leading-relaxed text-red-500"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div ref={endRef} className="h-1" />
    </div>
  );
}
