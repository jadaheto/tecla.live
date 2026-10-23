"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Search, Settings2, Sparkles, Sun, SunMoon } from "lucide-react";
import { TeclaLogo } from "@/components/layout/tecla-logo";
import { KittScanner } from "@/components/kitt/kitt-scanner";
import { RoadsterHud } from "@/components/roadster/roadster-hud";
import { Clock } from "@/components/layout/clock";
import { WeatherPill } from "@/components/layout/weather-pill";
import { FullscreenButton } from "@/components/layout/fullscreen-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUi } from "@/stores/ui";
import { openAssistant } from "@/features/ai/open-assistant";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/youtube", label: "Videos" },
  { href: "/music", label: "Música" },
  { href: "/radio", label: "Radio" },
  { href: "/navigate", label: "Navegar" },
  { href: "/drive", label: "Drive" },
] as const;

export function Header() {
  const pathname = usePathname();
  const setSearchOpen = useUi((state) => state.setSearchOpen);
  const theme = usePreferences((state) => state.theme);
  const setPreferences = usePreferences((state) => state.setPreferences);

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;

  function cycleTheme() {
    const next = theme === "light" ? "dark" : theme === "dark" ? "auto" : "light";
    setPreferences({ theme: next });
    toast({
      title:
        next === "light" ? "Tema claro" : next === "dark" ? "Tema oscuro" : "Tema automático",
      description:
        next === "auto"
          ? "Se ajusta al horario configurado en Ajustes (18:30 a 06:30)."
          : undefined,
      variant: "info",
    });
  }

  return (
    <header className="app-chrome sticky top-0 z-50 border-b border-border/70 bg-[var(--header)] backdrop-blur-2xl">
      <KittScanner className="absolute inset-x-0 bottom-0" />
      <RoadsterHud className="absolute inset-x-0 bottom-0" />
      <div className="mx-auto flex h-[76px] w-full max-w-[1840px] items-center gap-4 px-4 md:h-[84px] md:px-7">
        <TeclaLogo />

        <nav
          aria-label="Navegación principal"
          className="ml-4 hidden items-center gap-0.5 xl:flex"
        >
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted hover:bg-surface/70 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <WeatherPill />
          <Clock />
          <div className="mx-1 hidden h-7 w-px bg-border md:block" aria-hidden />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Buscar"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex items-center gap-2">
                Buscar <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              </span>
            </TooltipContent>
          </Tooltip>
          <Button
            variant="primary"
            onClick={() => openAssistant()}
            className="gap-2 px-3.5 sm:px-5"
            aria-label="Abrir TECLA AI"
          >
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">TECLA AI</span>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                aria-label={`Cambiar tema (actual: ${theme})`}
              >
                <ThemeIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cambiar tema</TooltipContent>
          </Tooltip>
          <div className="hidden sm:block">
            <FullscreenButton />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                aria-label="Ajustes"
                className="hidden size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface sm:flex"
              >
                <Settings2 className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Ajustes</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
