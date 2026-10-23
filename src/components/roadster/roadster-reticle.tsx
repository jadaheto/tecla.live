"use client";

import * as React from "react";
import { getVoiceLevel } from "@/features/ai/voice-level";
import { cn } from "@/lib/utils";

/**
 * Retícula de radar del estilo Roadster para el HUD de voz: anillos con
 * marcas, un barrido que gira y un rombo central que crece con la voz
 * (micrófono al escuchar, voz sintetizada al responder). Dibuja en canvas
 * leyendo el nivel por cuadro, sin pasar por React.
 */
export function RoadsterReticle({ status, size = 96, className }: { status: string; size?: number; className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const active = status === "listening" || status === "speaking" || status === "thinking" || status === "executing";

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * scale;
    canvas.height = size * scale;
    context.scale(scale, scale);
    const center = size / 2;
    const radius = size / 2 - 3;
    let frame = 0;
    let smooth = 0;
    let angle = 0;
    const red = (alpha: number) => `rgba(255, 43, 43, ${alpha})`;

    const draw = (time: number) => {
      const { level } = getVoiceLevel();
      const pulse = status === "thinking" || status === "executing" ? 0.25 + 0.15 * Math.sin(time / 160) : 0;
      const target = active ? Math.max(pulse, level) : 0.08 + 0.04 * Math.sin(time / 900);
      smooth += (target - smooth) * (target > smooth ? 0.4 : 0.15);
      angle += status === "listening" ? 0.05 : status === "speaking" ? 0.09 : 0.02;

      context.clearRect(0, 0, size, size);
      context.lineWidth = 1;
      // Anillos.
      for (const factor of [1, 0.68, 0.36]) {
        context.beginPath();
        context.arc(center, center, radius * factor, 0, Math.PI * 2);
        context.strokeStyle = red(factor === 1 ? 0.7 : 0.35);
        context.stroke();
      }
      // Marcas de escala del anillo exterior.
      for (let i = 0; i < 36; i += 1) {
        const a = (i / 36) * Math.PI * 2;
        const long = i % 9 === 0;
        const inner = radius - (long ? 7 : 3);
        context.beginPath();
        context.moveTo(center + Math.cos(a) * inner, center + Math.sin(a) * inner);
        context.lineTo(center + Math.cos(a) * radius, center + Math.sin(a) * radius);
        context.strokeStyle = red(long ? 0.9 : 0.45);
        context.stroke();
      }
      // Barrido.
      const sweep = context.createConicGradient(angle, center, center);
      sweep.addColorStop(0, red(0));
      sweep.addColorStop(0.85, red(0));
      sweep.addColorStop(1, red(active ? 0.45 : 0.2));
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius * 0.66, 0, Math.PI * 2);
      context.fillStyle = sweep;
      context.fill();
      // Cruz y rombo central que crece con la voz.
      context.strokeStyle = red(0.5);
      context.beginPath();
      context.moveTo(center - radius * 0.36, center);
      context.lineTo(center + radius * 0.36, center);
      context.moveTo(center, center - radius * 0.36);
      context.lineTo(center, center + radius * 0.36);
      context.stroke();
      const diamond = 4 + smooth * radius * 0.42;
      context.beginPath();
      context.moveTo(center, center - diamond);
      context.lineTo(center + diamond, center);
      context.lineTo(center, center + diamond);
      context.lineTo(center - diamond, center);
      context.closePath();
      context.fillStyle = red(0.25 + smooth * 0.6);
      context.fill();
      context.strokeStyle = red(0.95);
      context.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [status, active, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={cn("roadster-reticle", className)}
      role="img"
      aria-label={status === "speaking" ? "Copiloto hablando" : status === "listening" ? "Copiloto escuchando" : "Copiloto en espera"}
    />
  );
}
