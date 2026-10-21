"use client";

import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

/**
 * Escáner rojo de KITT (barrido tipo Larson): una luz que recorre la barra de
 * lado a lado con estela. Solo se muestra con el estilo «El auto fantástico».
 * La animación vive en CSS (`.kitt-scanner`) y respeta `reduce-motion`.
 */
export function KittScanner({ className }: { className?: string }) {
  const style = usePreferences((state) => state.visualStyle);
  if (style !== "kitt") return null;
  return (
    <div className={cn("kitt-scanner", className)} aria-hidden>
      <span className="kitt-scanner__light" />
    </div>
  );
}
