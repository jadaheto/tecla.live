"use client";

import { Compass, Mic, Radio, Sparkles, TvMinimalPlay } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAi } from "@/features/ai/store";
import { useIntegrations } from "@/features/integrations/hooks";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { label: "Pon música", prompt: "Pon música para empezar el día.", icon: Radio },
  { label: "Busca un video", prompt: "Busca un video de tecnología.", icon: TvMinimalPlay },
  { label: "Sorpréndeme", prompt: "Sorpréndeme con algo interesante de YouTube.", icon: Sparkles },
  { label: "Abrir Waze", prompt: "Abre Waze y busca Cartagena.", icon: Compass },
];

export function AiSpotlight() {
  const openWithPrompt = useAi((state) => state.openWithPrompt);
  const integrations = useIntegrations();
  const configured = integrations.data?.integrations.deepseek ?? false;

  return (
    <Card className="relative min-h-[250px] overflow-hidden border-accent/20 bg-gradient-to-br from-accent/[0.09] via-transparent to-violet/[0.12] p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-gradient-to-br from-[#ff8a5c]/30 to-[#7c2ae8]/20 blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-accent">
            <Sparkles className="size-3" aria-hidden />
            TECLA AI
          </p>
          <h2 className="mt-2 text-[19px] font-semibold tracking-tight">
            Tu copiloto está listo.
          </h2>
          <p className="mt-1 max-w-[250px] text-xs leading-relaxed text-muted">
            Pide música, videos, rutas o preguntas. Habla o escribe; tú decides.
          </p>
        </div>
        <span className="relative flex size-12 shrink-0 items-center justify-center">
          <span className="ai-ring absolute inset-0 rounded-full border border-accent/50" />
          <span className="absolute inset-1 rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] opacity-25 blur-md" />
          <span className="relative flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] text-white shadow-[0_10px_28px_-10px_rgba(255,90,60,0.9)]">
            <Sparkles className="size-5" />
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => openWithPrompt()}
        className="relative mt-4 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-background/35 px-4 text-left text-sm text-muted transition-colors hover:border-accent/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <Mic className="size-4 text-accent" aria-hidden />
        <span className="flex-1">Habla o escribe una orden…</span>
        <span className="hidden rounded-md border border-border px-1.5 py-0.5 text-[9px] font-medium sm:block">
          ⌘J
        </span>
      </button>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => openWithPrompt(suggestion.prompt)}
            className="flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-muted transition-colors hover:border-accent/30 hover:text-foreground"
          >
            <suggestion.icon className="size-3" aria-hidden />
            {suggestion.label}
          </button>
        ))}
      </div>

      <div className="relative mt-3 flex items-center gap-1.5 text-[9px] text-muted/80">
        <span
          className={cn(
            "size-1.5 rounded-full",
            configured ? "bg-emerald-400" : "bg-amber-400",
          )}
          aria-hidden
        />
        {integrations.isLoading
          ? "Comprobando integración…"
          : configured
            ? "DeepSeek conectado · voz opcional"
            : "DeepSeek pendiente de configurar · la interfaz sigue disponible"}
      </div>
    </Card>
  );
}
