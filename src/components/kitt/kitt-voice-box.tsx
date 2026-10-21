"use client";

import * as React from "react";
import { getVoiceLevel } from "@/features/ai/voice-level";
import { cn } from "@/lib/utils";

const COLUMNS = 3;
const SEGMENTS = 9;

/**
 * Modulador de voz de KITT: tres columnas de LED rojos que suben y bajan con
 * la voz (la central más alta). Lee el nivel de audio en cada cuadro sin
 * pasar por React: micrófono al escuchar, voz sintetizada al responder.
 */
export function KittVoiceBox({ status, className }: { status: string; className?: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const active = status === "listening" || status === "speaking" || status === "thinking" || status === "executing";

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const columns = Array.from(host.querySelectorAll<HTMLElement>("[data-column]"));
    let frame = 0;
    let smooth = 0;
    const tick = (time: number) => {
      const { level } = getVoiceLevel();
      const idlePulse = status === "thinking" || status === "executing" ? 0.18 + 0.12 * Math.sin(time / 180) : 0.04;
      // En espera, un latido lento en el centro: el modulador nunca parece apagado.
      const standby = 0.1 + 0.08 * Math.sin(time / 900);
      const target = active ? Math.max(idlePulse, level) : standby;
      smooth += (target - smooth) * (target > smooth ? 0.45 : 0.18);
      columns.forEach((column, index) => {
        const center = index === 1;
        const scale = center ? 1 : 0.72;
        const lit = Math.round(Math.min(1, smooth * 1.35) * SEGMENTS * scale);
        const segments = column.children;
        for (let i = 0; i < segments.length; i += 1) {
          // Los segmentos se encienden desde el centro hacia arriba y hacia abajo.
          const distance = Math.abs(i - (SEGMENTS - 1) / 2);
          const on = distance < lit / 2;
          (segments[i] as HTMLElement).dataset.on = on ? "1" : "0";
        }
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, active]);

  return (
    <div
      ref={hostRef}
      className={cn("kitt-voice-box", status === "speaking" && "is-speaking", status === "listening" && "is-listening", className)}
      role="img"
      aria-label={status === "speaking" ? "KITT hablando" : status === "listening" ? "KITT escuchando" : "KITT en espera"}
    >
      {Array.from({ length: COLUMNS }, (_, column) => (
        <div key={column} data-column={column} className="kitt-voice-box__column">
          {Array.from({ length: SEGMENTS }, (_, segment) => (
            <span key={segment} className="kitt-voice-box__segment" data-on="0" />
          ))}
        </div>
      ))}
    </div>
  );
}
