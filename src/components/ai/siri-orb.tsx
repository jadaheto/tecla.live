"use client";

import * as React from "react";
import { getVoiceLevel } from "@/features/ai/voice-level";
import { cn } from "@/lib/utils";
import type { AiVisualState } from "@/types";

type OrbMood = "idle" | "listening" | "thinking" | "speaking" | "error";

function moodFromStatus(status: AiVisualState): OrbMood {
  switch (status) {
    case "listening":
      return "listening";
    case "transcribing":
    case "thinking":
    case "executing":
      return "thinking";
    case "speaking":
      return "speaking";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function cssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

interface Blob {
  angle: number;
  speed: number;
  distance: number;
  radius: number;
  wobble: number;
  color: string;
}

/**
 * Orbe fluido de TECLA AI, al estilo de los asistentes de voz: varias masas de
 * color que respiran en reposo, se agitan con el nivel real del micrófono al
 * escuchar y laten con la voz sintetizada al responder. Dibujado en Canvas 2D.
 */
export function SiriOrb({
  status = "idle",
  size = 96,
  className,
}: {
  status?: AiVisualState;
  size?: number;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const moodRef = React.useRef<OrbMood>(moodFromStatus(status));

  React.useEffect(() => {
    moodRef.current = moodFromStatus(status);
  }, [status]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Colores del estilo visual (Cyberpunk define --orb-*); por defecto la paleta TECLA.
    const accent = cssColor("--orb-a", cssColor("--accent", "#ff5a3c"));
    const violet = cssColor("--orb-b", cssColor("--violet", "#a78bfa"));
    const aqua = cssColor("--orb-c", cssColor("--aqua", "#5eead4"));
    const blobs: Blob[] = [
      { angle: 0, speed: 0.55, distance: 0.16, radius: 0.36, wobble: 0.9, color: accent },
      { angle: 2.1, speed: -0.42, distance: 0.18, radius: 0.33, wobble: 1.3, color: violet },
      { angle: 4.2, speed: 0.37, distance: 0.14, radius: 0.3, wobble: 1.7, color: aqua },
      { angle: 1.1, speed: -0.6, distance: 0.2, radius: 0.26, wobble: 2.2, color: "#ffffff" },
    ];

    let frame = 0;
    let smoothLevel = 0;
    let energy = 0;
    let spin = 0;
    let last = performance.now();
    const center = size / 2;
    // Ondas que salen del orbe en los picos de la voz (como un altavoz que vibra).
    const ripples: Array<{ radius: number; alpha: number }> = [];
    let lastPeak = 0;
    // Historial de niveles: el contorno se deforma con la voz reciente, no solo con el instante.
    const trail = new Float32Array(24);
    let trailIndex = 0;

    /** Contorno ondulado: radio base más armónicos que crecen con el nivel de voz. */
    const wavyPath = (radius: number, amount: number, phase: number) => {
      ctx.beginPath();
      const points = 72;
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const k = Math.floor((i / points) * trail.length) % trail.length;
        const memory = trail[(trailIndex + k) % trail.length] ?? 0;
        const wobble =
          Math.sin(a * 3 + phase) * 0.35 + Math.sin(a * 5 - phase * 1.7) * 0.25 + Math.sin(a * 8 + phase * 2.3) * 0.15;
        const r = radius * (1 + amount * (wobble * 0.6 + memory * 0.45));
        const x = center + Math.cos(a) * r;
        const y = center + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
      last = now;
      const mood = moodRef.current;
      const { level } = getVoiceLevel();
      const target =
        mood === "listening" || mood === "speaking"
          ? Math.min(1, level * 4.5)
          : mood === "thinking"
            ? 0.35 + 0.15 * Math.sin(now / 180)
            : 0;
      smoothLevel += (target - smoothLevel) * (target > smoothLevel ? 0.35 : 0.08);
      const agitation = mood === "thinking" ? 1.8 : mood === "listening" ? 1.25 : mood === "speaking" ? 1.4 : 0.55;
      energy += (agitation - energy) * 0.05;
      const motion = reducedMotion ? 0.25 : 1;
      spin += dt * energy * motion;
      const t = spin;
      trail[trailIndex] = target;
      trailIndex = (trailIndex + 1) % trail.length;
      if ((mood === "speaking" || mood === "listening") && target > 0.55 && now - lastPeak > 160 && !reducedMotion) {
        ripples.push({ radius: center * 0.7, alpha: 0.55 });
        lastPeak = now;
        if (ripples.length > 5) ripples.shift();
      }

      ctx.clearRect(0, 0, size, size);

      // Ondas expansivas de la voz.
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const ripple = ripples[i];
        if (!ripple) continue;
        ripple.radius += dt * center * 1.6;
        ripple.alpha -= dt * 1.4;
        if (ripple.alpha <= 0 || ripple.radius > center) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = mood === "error" ? `rgba(248,113,113,${ripple.alpha})` : `${accent}${Math.round(ripple.alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.lineWidth = Math.max(1, size * 0.012);
        ctx.beginPath();
        ctx.arc(center, center, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Halo exterior que crece con el nivel.
      const haloRadius = center * (0.78 + smoothLevel * 0.2);
      const halo = ctx.createRadialGradient(center, center, haloRadius * 0.4, center, center, haloRadius);
      halo.addColorStop(0, "rgba(255,255,255,0)");
      halo.addColorStop(0.75, mood === "error" ? "rgba(248,113,113,0.18)" : `${accent}33`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // Núcleo recortado en círculo con las masas de color mezcladas.
      ctx.save();
      // El núcleo deja de ser un círculo perfecto: su contorno vibra con la voz.
      wavyPath(center * (0.62 + smoothLevel * 0.1), mood === "speaking" || mood === "listening" ? 0.08 + smoothLevel * 0.1 : 0.02, t * 2.4);
      ctx.clip();
      const base = ctx.createRadialGradient(center, center, 0, center, center, center * 0.72);
      base.addColorStop(0, mood === "error" ? "#7f1d1d" : "#1a0b2e");
      base.addColorStop(1, mood === "error" ? "#3b0a0a" : "#0b1026");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);

      ctx.globalCompositeOperation = "screen";
      ctx.filter = `blur(${Math.max(4, size * 0.08)}px)`;
      for (const blob of blobs) {
        const a = blob.angle + t * blob.speed;
        const breathe = Math.sin(t * blob.wobble + blob.angle) * 0.08;
        const dist = center * (blob.distance + breathe + smoothLevel * 0.12);
        const x = center + Math.cos(a) * dist;
        const y = center + Math.sin(a * 1.3) * dist;
        const r = center * (blob.radius + breathe * 0.5 + smoothLevel * 0.22);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        const color = mood === "error" ? "#f87171" : blob.color;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";

      // Brillo especular arriba.
      const gloss = ctx.createLinearGradient(0, center * 0.3, 0, center * 1.1);
      gloss.addColorStop(0, "rgba(255,255,255,0.28)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.ellipse(center, center * 0.72, center * 0.42, center * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Anillo fino; al pensar gira como indicador de progreso y al hablar ondula.
      ctx.lineWidth = Math.max(1.2, size * 0.018);
      ctx.strokeStyle = mood === "error" ? "rgba(248,113,113,0.7)" : "rgba(255,255,255,0.35)";
      if (mood === "thinking") {
        ctx.beginPath();
        const start = t * 2.2;
        ctx.arc(center, center, center * 0.7, start, start + Math.PI * 1.2);
      } else {
        wavyPath(center * (0.7 + smoothLevel * 0.05), mood === "speaking" || mood === "listening" ? 0.05 + smoothLevel * 0.12 : 0, -t * 1.8);
      }
      ctx.stroke();

      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn("block shrink-0", className)}
    />
  );
}
