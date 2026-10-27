"use client";

import * as React from "react";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

/**
 * Auto holográfico: un coupé en alambre proyectado en 3D que gira
 * lentamente, con el color del estilo activo, un plano de escaneo y un
 * anillo de suelo. Geometría propia (sin modelos de terceros), Canvas 2D,
 * se pausa con la pestaña oculta y respeta «Reducir animaciones».
 */
type Vec3 = [number, number, number];

/** Perfil lateral del coupé (x hacia adelante, y hacia arriba), en metros. */
const PROFILE: Array<[number, number]> = [
  [-2.3, 0.35],
  [-2.25, 0.75],
  [-1.9, 0.9],
  [-1.2, 0.95],
  [-0.6, 1.35],
  [0.5, 1.4],
  [1.3, 1.15],
  [1.9, 0.8],
  [2.3, 0.6],
  [2.35, 0.35],
];
const HALF_WIDTH = 0.92;
const WHEELS: Array<{ x: number; z: number }> = [
  { x: -1.5, z: -HALF_WIDTH },
  { x: -1.5, z: HALF_WIDTH },
  { x: 1.45, z: -HALF_WIDTH },
  { x: 1.45, z: HALF_WIDTH },
];
const WHEEL_RADIUS = 0.36;

function buildEdges(): Array<[Vec3, Vec3]> {
  const edges: Array<[Vec3, Vec3]> = [];
  const narrow = (y: number) => (y > 1 ? HALF_WIDTH * 0.8 : HALF_WIDTH);
  for (const side of [-1, 1]) {
    for (let i = 0; i < PROFILE.length; i += 1) {
      const [x1, y1] = PROFILE[i]!;
      const [x2, y2] = PROFILE[(i + 1) % PROFILE.length]!;
      edges.push([[x1, y1, side * narrow(y1)], [x2, y2, side * narrow(y2)]]);
    }
  }
  for (const [x, y] of PROFILE) edges.push([[x, y, -narrow(y)], [x, y, narrow(y)]]);
  // Pilares del techo y línea de cintura.
  edges.push([[-0.6, 1.35, -HALF_WIDTH * 0.8], [-1.2, 0.95, -HALF_WIDTH]]);
  edges.push([[-0.6, 1.35, HALF_WIDTH * 0.8], [-1.2, 0.95, HALF_WIDTH]]);
  for (const wheel of WHEELS) {
    const segments = 14;
    for (let i = 0; i < segments; i += 1) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      edges.push([
        [wheel.x + Math.cos(a1) * WHEEL_RADIUS, WHEEL_RADIUS + Math.sin(a1) * WHEEL_RADIUS, wheel.z],
        [wheel.x + Math.cos(a2) * WHEEL_RADIUS, WHEEL_RADIUS + Math.sin(a2) * WHEEL_RADIUS, wheel.z],
      ]);
    }
  }
  return edges;
}

const EDGES = buildEdges();

function cssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function HoloCar({
  width = 260,
  height = 150,
  color,
  intensity = 1,
  className,
  label,
}: {
  width?: number;
  height?: number;
  /** Color del alambre; por defecto el acento del estilo activo. */
  color?: string;
  /** 1 normal; más alto = brillo pulsante (por ejemplo cargando). */
  intensity?: number;
  className?: string;
  label?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const visualStyle = usePreferences((state) => state.visualStyle);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const stroke = color ?? cssColor("--holo", cssColor("--accent", "#5eead4"));
    let frame = 0;
    let angle = 0.6;
    let last = performance.now();
    let scan = 0;
    const scale = Math.min(width / 6.2, height / 3.4);
    const cx = width / 2;
    const cy = height * 0.6;
    const tilt = -0.42;
    const distance = 9;

    const project = ([x, y, z]: Vec3): { x: number; y: number; depth: number } => {
      const rx = x * Math.cos(angle) - z * Math.sin(angle);
      const rz = x * Math.sin(angle) + z * Math.cos(angle);
      const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
      const rz2 = y * Math.sin(tilt) + rz * Math.cos(tilt);
      const perspective = distance / (distance + rz2);
      return { x: cx + rx * scale * perspective, y: cy - (ry - 0.6) * scale * perspective, depth: rz2 };
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduceMotion) {
        angle += dt * 0.45;
        scan = (scan + dt * 0.35) % 1;
      }
      const pulse = intensity > 1 ? 0.75 + 0.25 * Math.sin(now / 350) : 1;
      context.clearRect(0, 0, width, height);

      // Anillo de suelo.
      context.strokeStyle = stroke;
      context.globalAlpha = 0.35;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(cx, cy + scale * 0.62, scale * 2.9, scale * 0.75, 0, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([4, 8]);
      context.beginPath();
      context.ellipse(cx, cy + scale * 0.62, scale * 2.2, scale * 0.55, 0, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);

      // Alambre con profundidad: las aristas lejanas se atenúan.
      context.lineWidth = 1.3;
      context.shadowColor = stroke;
      context.shadowBlur = 8 * pulse;
      for (const [a, b] of EDGES) {
        const pa = project(a);
        const pb = project(b);
        const depth = (pa.depth + pb.depth) / 2;
        context.globalAlpha = Math.max(0.18, Math.min(1, 0.85 - depth * 0.22)) * pulse;
        context.beginPath();
        context.moveTo(pa.x, pa.y);
        context.lineTo(pb.x, pb.y);
        context.stroke();
      }
      context.shadowBlur = 0;

      // Plano de escaneo que recorre el auto de arriba abajo.
      const scanY = cy - scale * 1.1 + scan * scale * 1.9;
      const gradient = context.createLinearGradient(cx - scale * 3, 0, cx + scale * 3, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, stroke);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.globalAlpha = 0.55;
      context.fillStyle = gradient;
      context.fillRect(cx - scale * 3, scanY, scale * 6, 1.2);
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    frame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [width, height, color, intensity, reduceMotion, visualStyle]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={cn("block", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
