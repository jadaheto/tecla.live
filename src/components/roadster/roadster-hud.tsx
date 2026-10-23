"use client";

import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

const TICKS = 48;

/**
 * Regla de cabina del estilo Roadster: una línea fina con marcas de escala y
 * un rombo central, como la línea de horizonte de un HUD de caza. Solo se
 * muestra con el estilo «Roadster».
 */
export function RoadsterHud({ className }: { className?: string }) {
  const style = usePreferences((state) => state.visualStyle);
  if (style !== "roadster") return null;
  return (
    <div className={cn("roadster-hud", className)} aria-hidden>
      {Array.from({ length: TICKS }, (_, index) => (
        <span key={index} className={cn("roadster-hud__tick", index % 6 === 0 && "is-major")} />
      ))}
      <span className="roadster-hud__center" />
    </div>
  );
}
