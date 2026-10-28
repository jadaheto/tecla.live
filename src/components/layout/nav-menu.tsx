"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Car,
  Compass,
  Gauge,
  Grid2x2,
  Heart,
  Home,
  Maximize2,
  Menu,
  Music2,
  Orbit,
  PlugZap,
  Podcast,
  QrCode,
  Radio,
  Settings2,
  SunMoon,
  TvMinimalPlay,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/youtube", label: "Videos", icon: TvMinimalPlay },
  { href: "/music", label: "Música", icon: Music2 },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/podcasts", label: "Podcasts", icon: Podcast },
  { href: "/navigate", label: "Navegar", icon: Compass },
  { href: "/cargadores", label: "Cargadores", icon: PlugZap },
  { href: "/drive", label: "Drive", icon: Gauge },
  { href: "/tesla", label: "Tesla", icon: Car },
  { href: "/apps", label: "Apps", icon: Grid2x2 },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/settings", label: "Ajustes", icon: Settings2 },
] as const;

/**
 * Menú de secciones para pantallas estrechas (el Tesla en modo conductor
 * reduce el navegador a media pantalla y la cabecera pierde sus enlaces).
 * Botones grandes, sin hover, con las acciones que la cabecera oculta.
 */
export function NavMenu({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const setAmbientOpen = useUi((state) => state.setAmbientOpen);
  const setRemoteOpen = useUi((state) => state.setRemoteOpen);
  const theme = usePreferences((state) => state.theme);
  const setPreferences = usePreferences((state) => state.setPreferences);

  function fullscreen() {
    const element = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    else void element.requestFullscreen?.().catch(() => undefined);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú de secciones"
        aria-expanded={open}
        className={cn("flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface", className)}
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" aria-describedby={undefined} className="p-4 md:p-5">
          <DialogTitle className="mb-4 text-xl">Secciones</DialogTitle>
          <nav aria-label="Secciones de TECLA LIVE" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {SECTIONS.map((section) => {
              const active = section.href === "/" ? pathname === "/" : pathname.startsWith(section.href);
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[4.5rem] items-center gap-3 rounded-2xl border px-4 text-[15px] font-medium transition-colors active:scale-[0.98]",
                    active ? "border-accent/50 bg-accent/12 text-foreground" : "border-border bg-surface/50 text-foreground/90",
                  )}
                >
                  <section.icon className={cn("size-6 shrink-0", active ? "text-accent" : "text-muted")} aria-hidden />
                  {section.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => { setOpen(false); setAmbientOpen(true); }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-surface/50 text-[13px] font-medium">
              <Orbit className="size-5 text-muted" aria-hidden />
              Pantalla ambiente
            </button>
            <button type="button" onClick={() => { setOpen(false); setRemoteOpen(true); }} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-surface/50 text-[13px] font-medium">
              <QrCode className="size-5 text-muted" aria-hidden />
              Control remoto
            </button>
            <button type="button" onClick={fullscreen} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-surface/50 text-[13px] font-medium">
              <Maximize2 className="size-5 text-muted" aria-hidden />
              Pantalla completa
            </button>
            <button
              type="button"
              onClick={() => setPreferences({ theme: theme === "light" ? "dark" : theme === "dark" ? "auto" : "light" })}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-surface/50 text-[13px] font-medium"
            >
              <SunMoon className="size-5 text-muted" aria-hidden />
              Tema: {theme === "light" ? "claro" : theme === "dark" ? "oscuro" : "auto"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
