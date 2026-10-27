"use client";

import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

/**
 * Línea de puente bajo la cabecera en el estilo «Discovery»: segmentos
 * holográficos con un pulso que recorre la barra, como los paneles de
 * estado de la nave. Solo decorativo.
 */
export function DiscoveryHud({ className }: { className?: string }) {
  const style = usePreferences((state) => state.visualStyle);
  if (style !== "discovery") return null;
  return (
    <div className={cn("disco-hud", className)} aria-hidden>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="disco-hud__segment" style={{ animationDelay: `${index * 0.22}s` }} />
      ))}
      <span className="disco-hud__pulse" />
    </div>
  );
}
