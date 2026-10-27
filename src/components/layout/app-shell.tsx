"use client";

import { usePathname } from "next/navigation";
import { MonitorUp, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchDialog } from "@/components/search/search-dialog";
import { AiDock } from "@/components/ai/ai-dock";
import { WakeWordListener } from "@/components/ai/wake-word-listener";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { MiniPlayer } from "@/components/media/mini-player";
import { PlaybackProvider } from "@/components/media/playback-provider";
import { StyleIntro } from "@/components/style-intro";
import { BootSequence } from "@/components/boot-sequence";
import { AmbientScreen } from "@/components/ambient/ambient-screen";
import { RemoteProvider } from "@/components/remote/remote-provider";
import { RemoteDialog } from "@/components/remote/remote-dialog";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const displayMode = usePreferences((state) => state.displayMode);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const isPlayer = pathname.startsWith("/watch/");
  const isImmersive = displayMode === "cinema" || displayMode === "kiosk";

  // El control remoto del celular es una pantalla aparte: sin cabecera, reproductor ni asistente.
  if (pathname.startsWith("/remote/")) {
    return <div className="relative min-h-dvh">{children}</div>;
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="ambient-shell" aria-hidden />
      <Header />

      {isImmersive ? (
        <button
          type="button"
          onClick={() => setPreferences({ displayMode: "normal" })}
          className="fixed right-4 top-4 z-[80] flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 text-xs font-medium text-white backdrop-blur-xl"
        >
          <X className="size-4" aria-hidden />
          Salir de modo {displayMode === "cinema" ? "cine" : "kiosco"}
        </button>
      ) : null}

      <main
        id="contenido"
        className={cn(
          "app-main relative z-10 mx-auto w-full max-w-[1840px] flex-1 px-4 pb-28 pt-4 sm:px-6 md:px-7 md:pt-6 lg:pb-12",
          isPlayer && "pt-3 md:pt-4",
          isImmersive && "max-w-none px-2 md:px-3",
        )}
      >
        {children}
      </main>

      {!isPlayer ? (
        <footer className="app-chrome relative z-10 mx-auto flex w-full max-w-[1840px] flex-col gap-2 px-6 pb-28 pt-8 text-[11px] text-muted md:flex-row md:items-center md:justify-between md:px-7 lg:pb-8">
          <span>TECLA LIVE · Entretenimiento inteligente para tu Tesla.</span>
          <span className="flex items-center gap-1.5">
            <MonitorUp className="size-3.5" aria-hidden />
            Diseñado para pantallas táctiles horizontales · tecla.live
          </span>
        </footer>
      ) : null}

      <MobileNav />
      <SearchDialog />
      <ShortcutsDialog />
      <PlaybackProvider />
      <MiniPlayer pathname={pathname} />
      <AiDock />
      <WakeWordListener />
      <RemoteProvider />
      <RemoteDialog />
      <AmbientScreen />
      <BootSequence />
      <StyleIntro />
    </div>
  );
}
