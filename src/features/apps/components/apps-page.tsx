"use client";

import Link from "next/link";
import { ExternalLink, LayoutGrid, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardAppCard } from "@/components/dashboard/quick-access";
import { Button } from "@/components/ui/button";
import { APPS } from "@/lib/catalog";
import { useAi } from "@/features/ai/store";

const GROUPS = [
  { id: "video", title: "Video y series", description: "Contenido cinematográfico y accesos oficiales." },
  { id: "music", title: "Música y audio", description: "Música, podcasts y emisoras." },
  { id: "navigation", title: "Navegación", description: "Rutas y lugares con enlaces oficiales." },
  { id: "live", title: "En vivo", description: "Radio, canales y transmisiones." },
] as const;

export function AppsPage() {
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  return (
    <div>
      <PageHeader
        eyebrow="Ecosistema"
        title="Todas tus aplicaciones."
        description="Un solo lugar para todo. Los servicios externos se abren de forma oficial y sin eludir sus restricciones."
        actions={
          <Button variant="primary" onClick={() => openWithPrompt("¿Qué me recomiendas abrir hoy?")}>
            <Sparkles className="size-4" aria-hidden />
            Preguntar a TECLA AI
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-2 text-[11px] text-muted">
        <LayoutGrid className="size-3.5" aria-hidden />
        {APPS.length} accesos · TECLA AI incluido
      </div>

      <div className="space-y-8">
        {GROUPS.map((group) => {
          const apps = APPS.filter((app) => app.category === group.id);
          if (apps.length === 0) return null;
          return (
            <section key={group.id} aria-label={group.title}>
              <div className="mb-3">
                <p className="eyebrow">{group.title}</p>
                <p className="mt-1 text-xs text-muted">{group.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {apps.map((app) => (
                  <DashboardAppCard key={app.id} app={app} className="w-full" />
                ))}
              </div>
            </section>
          );
        })}

        <section aria-label="TECLA AI" className="rounded-[2rem] border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface/50 to-violet/[0.1] p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <p className="eyebrow flex items-center gap-1.5 text-accent">
                <Sparkles className="size-3" aria-hidden />
                Copiloto
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Una voz para todo TECLA LIVE.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Pide música, videos, rutas o cambios de pantalla. TECLA AI usa herramientas reales y
                te informa si el navegador bloquea una acción.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openWithPrompt()}>
                <Sparkles className="size-4" aria-hidden />
                Hablar con TECLA AI
              </Button>
              <Link
                href="/settings#ia"
                className="flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-medium text-muted hover:text-foreground"
              >
                Configurar voz
              </Link>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-6 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
        Netflix, Disney+ y Twitch se abren en sus sitios oficiales cuando corresponde. TECLA LIVE no
        descarga, desbloquea ni redistribuye contenido protegido.
      </p>
    </div>
  );
}
