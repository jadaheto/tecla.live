"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Search, Settings2, Sparkles } from "lucide-react";
import { openAssistant } from "@/features/ai/open-assistant";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/youtube", label: "Videos", icon: Search },
  { href: "/settings", label: "Ajustes", icon: Settings2 },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación rápida"
      className="safe-bottom app-chrome fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-[var(--header)] px-3 pt-2 backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {ITEMS.slice(0, 2).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium",
                active ? "text-foreground" : "text-muted",
              )}
            >
              <item.icon className={cn("size-5", active && "text-accent")} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => openAssistant()}
          aria-label="Abrir TECLA AI"
          className="relative -mt-7 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff5a3c] to-[#8b3dff] text-white shadow-[0_18px_40px_-14px_rgba(255,90,60,0.8)]"
        >
          <Sparkles className="size-6" />
        </button>
        {ITEMS.slice(2).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium",
                active ? "text-foreground" : "text-muted",
              )}
            >
              <item.icon className={cn("size-5", active && "text-accent")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
