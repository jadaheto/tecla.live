"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AiPanel } from "@/components/ai/ai-panel";
import { useAi } from "@/features/ai/store";

export function AiDock() {
  const pathname = usePathname();
  const open = useAi((state) => state.panelOpen);
  const setOpen = useAi((state) => state.setPanelOpen);
  if (pathname === "/ai") return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir TECLA AI"
          className="group fixed bottom-[88px] right-4 z-[70] hidden items-center gap-2 rounded-full lg:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-background lg:bottom-7 lg:right-7"
        >
          <span className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] text-white shadow-[0_20px_50px_-16px_rgba(255,90,60,0.85)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 lg:size-15">
            <span className="ai-ring absolute inset-0 rounded-full border border-accent/50" aria-hidden />
            <span className="absolute inset-x-2 top-1.5 h-1/3 rounded-full bg-white/20 blur-md" aria-hidden />
            <Sparkles className="relative size-6" aria-hidden />
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-background bg-emerald-400" aria-hidden />
          </span>
          <span className="hidden rounded-full border border-border bg-[var(--glass-strong)] px-3 py-2 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-xl group-hover:bg-surface-strong lg:block">
            TECLA AI
            <span className="ml-1.5 text-[9px] text-muted">⌘J</span>
          </span>
        </button>
      ) : null}

      <AiPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
