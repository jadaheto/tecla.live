"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { speedRatio, type DriveSceneId } from "./drive-config";

interface Star {
  angle: number;
  radius: number;
  size: number;
  phase: number;
}

interface Ridge {
  points: number[];
  color: string;
  alpha: number;
}

interface SceneData {
  stars: Star[];
  ridges: Ridge[];
}

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return value / 4_294_967_296;
  };
}

function createSceneData(scene: DriveSceneId): SceneData {
  const random = seeded(scene === "orbit" ? 17 : scene === "coast" ? 43 : 91);
  const starCount = scene === "orbit" ? 190 : 90;
  const stars = Array.from({ length: starCount }, () => ({
    angle: random() * Math.PI * 2,
    radius: 0.04 + random() * 0.95,
    size: 0.4 + random() * 1.8,
    phase: random() * Math.PI * 2,
  }));

  const ridges: Ridge[] =
    scene === "canyon"
      ? [
          { color: "#7c2d12", alpha: 0.28, points: Array.from({ length: 18 }, () => 0.08 + random() * 0.24) },
          { color: "#431407", alpha: 0.5, points: Array.from({ length: 14 }, () => 0.2 + random() * 0.22) },
          { color: "#190b0f", alpha: 0.85, points: Array.from({ length: 11 }, () => 0.32 + random() * 0.26) },
        ]
      : scene === "coast"
        ? [{ color: "#071a22", alpha: 0.85, points: Array.from({ length: 10 }, () => 0.05 + random() * 0.12) }]
        : [];

  return { stars, ridges };
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  ratio: number,
  data: SceneData,
  reducedMotion: boolean,
) {
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#03050c");
  sky.addColorStop(0.46, "#061522");
  sky.addColorStop(0.7, "#06100f");
  sky.addColorStop(1, "#020304");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const nebula = ctx.createRadialGradient(
    width * 0.72,
    height * 0.4,
    0,
    width * 0.72,
    height * 0.4,
    width * 0.58,
  );
  nebula.addColorStop(0, "rgba(94, 234, 212, 0.13)");
  nebula.addColorStop(0.36, "rgba(59, 130, 246, 0.08)");
  nebula.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);

  const drift = 0.012 + ratio * 0.32;
  for (const star of data.stars) {
    const radius = (star.radius + (reducedMotion ? 0 : time * drift * (0.55 + star.size * 0.14))) % 1;
    const distance = Math.min(width, height) * (0.08 + radius * 0.74);
    const x = centerX + Math.cos(star.angle + time * 0.004) * distance;
    const y = centerY + Math.sin(star.angle) * distance * 0.56;
    const alpha = Math.max(0.08, 0.9 - radius * 0.72);
    const twinkle = 0.75 + Math.sin(time * 1.4 + star.phase) * 0.25;
    ctx.beginPath();
    ctx.fillStyle = `rgba(220, 255, 250, ${alpha * twinkle})`;
    ctx.arc(x, y, star.size * (0.7 + ratio * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  const planetX = width * 0.73;
  const planetY = height * 0.43;
  const planetRadius = Math.min(width, height) * 0.115;
  const planetGlow = ctx.createRadialGradient(
    planetX,
    planetY,
    planetRadius * 0.4,
    planetX,
    planetY,
    planetRadius * 2.4,
  );
  planetGlow.addColorStop(0, "rgba(94, 234, 212, 0.26)");
  planetGlow.addColorStop(0.4, "rgba(59, 130, 246, 0.1)");
  planetGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = planetGlow;
  ctx.fillRect(planetX - planetRadius * 2.8, planetY - planetRadius * 2.8, planetRadius * 5.6, planetRadius * 5.6);

  const planet = ctx.createRadialGradient(
    planetX - planetRadius * 0.35,
    planetY - planetRadius * 0.4,
    0,
    planetX,
    planetY,
    planetRadius,
  );
  planet.addColorStop(0, "#b9fff1");
  planet.addColorStop(0.2, "#3ed6c7");
  planet.addColorStop(0.62, "#0e5666");
  planet.addColorStop(1, "#04151d");
  ctx.beginPath();
  ctx.fillStyle = planet;
  ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(180, 255, 242, 0.18)";
  ctx.lineWidth = 1;
  ctx.ellipse(planetX, planetY, planetRadius * 1.7, planetRadius * 0.35, -0.23, 0, Math.PI * 2);
  ctx.stroke();

  const horizon = height * 0.74;
  const horizonGlow = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 50);
  horizonGlow.addColorStop(0, "rgba(94, 234, 212, 0)");
  horizonGlow.addColorStop(0.5, "rgba(94, 234, 212, 0.14)");
  horizonGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, horizon - 20, width, 80);

  const path = ctx.createLinearGradient(0, height, 0, horizon);
  path.addColorStop(0, "rgba(94, 234, 212, 0.12)");
  path.addColorStop(1, "rgba(94, 234, 212, 0)");
  ctx.beginPath();
  ctx.fillStyle = path;
  ctx.moveTo(width * 0.48, horizon);
  ctx.lineTo(width * 0.62, height);
  ctx.lineTo(width * 0.38, height);
  ctx.closePath();
  ctx.fill();
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizon: number,
  offset: number,
  ratio: number,
  accent: string,
) {
  const vanishingX = width * 0.52;
  ctx.beginPath();
  ctx.moveTo(vanishingX - 5, horizon);
  ctx.lineTo(width * 0.08, height);
  ctx.lineTo(width * 0.92, height);
  ctx.lineTo(vanishingX + 5, horizon);
  ctx.closePath();
  ctx.fillStyle = "rgba(3, 7, 10, 0.56)";
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.18 + ratio * 0.22;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vanishingX - 4, horizon);
  ctx.lineTo(width * 0.1, height);
  ctx.moveTo(vanishingX + 4, horizon);
  ctx.lineTo(width * 0.9, height);
  ctx.stroke();

  for (let index = 0; index < 14; index += 1) {
    const progress = (index / 14 + offset) % 1;
    const depth = progress * progress;
    const y = horizon + depth * (height - horizon);
    const nextY = horizon + Math.min(1, progress + 0.025) ** 2 * (height - horizon);
    const half = 4 + depth * width * 0.23;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + progress * 0.42})`;
    ctx.lineWidth = 1 + depth * 3;
    ctx.moveTo(vanishingX - half * 0.08, y);
    ctx.lineTo(vanishingX + half * 0.08, y + (nextY - y) * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCoast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  ratio: number,
  data: SceneData,
  reducedMotion: boolean,
) {
  const horizon = height * 0.61;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#0b1025");
  sky.addColorStop(0.46, "#4a2947");
  sky.addColorStop(0.77, "#b75f54");
  sky.addColorStop(1, "#efaa72");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * 0.71;
  const sunY = horizon - Math.min(80, height * 0.1);
  const sunRadius = Math.min(width, height) * 0.065;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 4.4);
  glow.addColorStop(0, "rgba(255, 224, 164, 0.52)");
  glow.addColorStop(0.27, "rgba(255, 163, 107, 0.2)");
  glow.addColorStop(1, "rgba(255, 120, 80, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunRadius * 4.4, sunY - sunRadius * 4.4, sunRadius * 8.8, sunRadius * 8.8);
  ctx.beginPath();
  ctx.fillStyle = "#ffe0a5";
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  const water = ctx.createLinearGradient(0, horizon, 0, height);
  water.addColorStop(0, "#18313d");
  water.addColorStop(0.32, "#0a202b");
  water.addColorStop(1, "#03080c");
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, width, height - horizon);

  const glintOffset = reducedMotion ? 0 : (time * (0.12 + ratio * 0.7)) % 1;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 20; index += 1) {
    const progress = (index / 20 + glintOffset) % 1;
    const y = horizon + progress * progress * (height - horizon);
    const alpha = (1 - progress) * (0.08 + ratio * 0.2);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 208, 158, ${alpha})`;
    ctx.lineWidth = 1 + progress * 2;
    ctx.moveTo(width * 0.22, y);
    ctx.lineTo(width * 0.78, y);
    ctx.stroke();
  }
  ctx.restore();

  for (const ridge of data.ridges) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(7, 19, 25, ${ridge.alpha})`;
    ctx.moveTo(0, horizon);
    ridge.points.forEach((point, index) => {
      const x = (index / (ridge.points.length - 1)) * width;
      const y = horizon - point * height * 0.62;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, horizon);
    ctx.closePath();
    ctx.fill();
  }

  drawRoad(ctx, width, height, horizon + 9, glintOffset, ratio, "#ffb86b");
}

function drawCanyon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  ratio: number,
  data: SceneData,
  reducedMotion: boolean,
) {
  const horizon = height * 0.69;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#05060d");
  sky.addColorStop(0.48, "#1d1423");
  sky.addColorStop(1, "#8a3f2c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.34,
    horizon - 12,
    0,
    width * 0.34,
    horizon - 12,
    width * 0.5,
  );
  glow.addColorStop(0, "rgba(245, 158, 11, 0.22)");
  glow.addColorStop(0.52, "rgba(154, 52, 18, 0.11)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  for (const star of data.stars) {
    const x = ((star.angle / (Math.PI * 2)) * width + Math.sin(time * 0.12 + star.phase) * 3) % width;
    const y = (star.radius * 0.56 + 0.03) * height;
    const twinkle = 0.6 + Math.sin(time + star.phase) * 0.4;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 226, 183, ${0.2 + twinkle * 0.35})`;
    ctx.arc(x, y, star.size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  data.ridges.forEach((ridge, layerIndex) => {
    ctx.beginPath();
    ctx.fillStyle = ridge.color;
    ctx.globalAlpha = ridge.alpha;
    ctx.moveTo(0, height);
    ridge.points.forEach((point, index) => {
      const x = (index / (ridge.points.length - 1)) * width;
      const base = horizon + layerIndex * 0.03 * height;
      const y = base - point * height * (0.3 - layerIndex * 0.07);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  drawRoad(ctx, width, height, horizon + 2, reducedMotion ? 0 : (time * (0.08 + ratio * 0.72)) % 1, ratio, "#f59e0b");
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: DriveSceneId,
  time: number,
  speed: number,
  data: SceneData,
  reducedMotion: boolean,
) {
  const ratio = speedRatio(speed);
  ctx.clearRect(0, 0, width, height);
  if (scene === "orbit") drawOrbit(ctx, width, height, time, ratio, data, reducedMotion);
  else if (scene === "coast") drawCoast(ctx, width, height, time, ratio, data, reducedMotion);
  else drawCanyon(ctx, width, height, time, ratio, data, reducedMotion);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.52,
    Math.min(width, height) * 0.18,
    width * 0.5,
    height * 0.52,
    Math.max(width, height) * 0.74,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function DriveCanvas({
  scene,
  speed,
  className,
}: {
  scene: DriveSceneId;
  speed: number;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const speedRef = React.useRef(speed);
  const sceneRef = React.useRef(scene);

  React.useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  React.useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const data = createSceneData(scene);
    let frame = 0;
    let started = performance.now();
    let width = 1;
    let height = 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const render = (now: number) => {
      const time = reducedMotion ? 0 : (now - started) / 1_000;
      drawFrame(context, width, height, sceneRef.current, time, speedRef.current, data, reducedMotion);
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      started = 0;
    };
  }, [scene]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("absolute inset-0 size-full", className)}
    />
  );
}
