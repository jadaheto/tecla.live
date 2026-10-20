"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { APP_BY_ID, QUICK_ACCESS_IDS, type AppDefinition } from "@/lib/catalog";
import { useAi } from "@/features/ai/store";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

function useOpenApp() {
  const openWithPrompt = useAi((state) => state.openWithPrompt);
  const router = useRouter();

  return (app: AppDefinition) => {
    if (app.id === "ai") {
      openWithPrompt(app.aiPrompt);
      return;
    }
    if (app.external) {
      const opened = window.open(app.href, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast({
          title: "No se pudo abrir la aplicación",
          description: "El navegador bloqueó la pestaña. Permite ventanas emergentes para TECLA LIVE.",
          variant: "error",
        });
      }
      return;
    }
    router.push(app.href);
  };
}

export function QuickAccess() {
  const openApp = useOpenApp();

  return (
    <section aria-label="Accesos rápidos" className="mt-5 md:mt-6">
      <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:gap-3">
        {QUICK_ACCESS_IDS.map((id) => {
          const app = APP_BY_ID.get(id);
          if (!app) return null;
          return <QuickTile key={app.id} app={app} onOpen={() => openApp(app)} />;
        })}
      </div>
    </section>
  );
}


function QuickTile({ app, onOpen }: { app: AppDefinition; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${app.name}`}
      className="group flex w-[92px] shrink-0 snap-start flex-col items-center gap-2 rounded-3xl p-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:w-[104px]"
    >
      <span
        className={cn(
          "relative flex size-[68px] items-center justify-center overflow-hidden rounded-[21px] bg-gradient-to-br text-white shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 sm:size-[74px]",
          app.gradient,
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
        <app.icon
          className={app.wide ? "relative h-auto w-[72%]" : "relative size-7"}
          aria-hidden
        />
        {app.id === "ai" ? (
          <Sparkles className="absolute bottom-2 right-2 size-3 text-white/80" aria-hidden />
        ) : null}
      </span>
      <span className="flex max-w-full items-center gap-1 text-[11px] font-medium leading-tight text-foreground/90">
        <span className="truncate">{app.name}</span>
        {app.external ? (
          <ArrowUpRight className="size-2.5 shrink-0 text-muted" aria-hidden />
        ) : null}
      </span>
    </button>
  );
}

export function DashboardAppCard({ app, className }: { app: AppDefinition; className?: string }) {
  const openApp = useOpenApp();
  const content = (
    <>
      <span
        className={cn(
          "relative flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg",
          app.gradient,
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
        <app.icon
          className={app.wide ? "relative h-auto w-12" : "relative size-6"}
          aria-hidden
        />
      </span>
      <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
        {app.name}
        {app.external ? (
          <ArrowUpRight className="size-3 text-muted" aria-hidden />
        ) : null}
      </span>
      <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
        {app.description}
      </span>
    </>
  );

  if (app.external) {
    return (
      <button
        type="button"
        onClick={() => openApp(app)}
        className={cn("group flex min-h-[148px] w-[216px] shrink-0 snap-start flex-col rounded-3xl border border-border bg-surface p-4 text-left transition-colors hover:bg-[var(--glass)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]", className)}
      >
        {content}
      </button>
    );
  }

  if (app.id === "ai") {
    return (
      <button
        type="button"
        onClick={() => openApp(app)}
        className={cn("group flex min-h-[148px] w-[216px] shrink-0 snap-start flex-col rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/12 to-violet/10 p-4 text-left transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]", className)}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={app.href}
      className={cn("group flex min-h-[148px] w-[216px] shrink-0 snap-start flex-col rounded-3xl border border-border bg-surface p-4 text-left transition-colors hover:bg-[var(--glass)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]", className)}
    >
      {content}
    </Link>
  );
}
