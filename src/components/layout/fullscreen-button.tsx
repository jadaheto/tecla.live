"use client";

import * as React from "react";
import { Expand, Minimize } from "lucide-react";
import { toast } from "@/stores/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!document.fullscreenEnabled) {
        toast({
          title: "Pantalla completa no disponible",
          description:
            "Este navegador no permite pantalla completa. En el Tesla puedes usar el botón de pantalla del navegador.",
          variant: "info",
        });
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      toast({
        title: "El navegador bloqueó la pantalla completa",
        description: "La acción necesita un toque directo y compatibilidad del navegador.",
        variant: "error",
      });
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {isFullscreen ? <Minimize className="size-5" /> : <Expand className="size-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</TooltipContent>
    </Tooltip>
  );
}
