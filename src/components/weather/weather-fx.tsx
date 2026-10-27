"use client";

import * as React from "react";
import { useWeather } from "@/features/integrations/hooks";
import { particleCount, weatherFxPalette, weatherFxPreset, type WeatherFxPreset } from "@/features/weather/fx-presets";
import { usePreferences } from "@/stores/preferences";

interface Particle {
  x: number;
  y: number;
  z: number;
  phase: number;
}

interface Blob {
  x: number;
  y: number;
  r: number;
  v: number;
  a: number;
}

/**
 * Efecto de clima en tiempo real sobre la pantalla principal: lluvia,
 * llovizna, tormenta con relámpagos, nieve, niebla, nubes, sol o estrellas,
 * según el clima real de la ubicación configurada. Canvas a pantalla completa
 * sin eventos de puntero, se pausa con la pestaña oculta, baja la densidad si
 * el dispositivo no mantiene los cuadros y se apaga con «Reducir animaciones»
 * o con la preferencia «Efectos de clima».
 */
export function WeatherFx() {
  const enabled = usePreferences((state) => state.weatherEffects);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const weather = useWeather();
  const code = weather.data?.code;
  const isDay = weather.data?.isDay ?? true;
  const windSpeed = weather.data?.windSpeed ?? 0;
  const preset = React.useMemo(
    () => (typeof code === "number" ? weatherFxPreset({ code, isDay, windSpeed }) : null),
    [code, isDay, windSpeed],
  );
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || reduceMotion || !preset || preset.kind === "none") return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let disposed = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    let quality = 1;
    let particles: Particle[] = [];
    let blobs: Blob[] = [];
    let last = performance.now();
    let flashAt = last + 3_000 + Math.random() * 5_000;
    let flashLevel = 0;
    let slowFrames = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      scale = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      seed();
    };

    const seed = () => {
      const count = particleCount(preset, width, height, quality);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      }));
      blobs = Array.from({ length: Math.max(0, Math.round(preset.density * quality)) }, (_, index) => ({
        x: Math.random() * width,
        y: preset.kind === "clouds" ? (index / Math.max(1, preset.density)) * height * 0.45 : Math.random() * height,
        r: preset.kind === "fog" ? 220 + Math.random() * 260 : 140 + Math.random() * 180,
        v: (0.5 + Math.random()) * preset.speed,
        a: 0.05 + Math.random() * 0.08,
      }));
    };

    const draw = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dt > 0.04) {
        slowFrames += 1;
        if (slowFrames > 45 && quality > 0.4) {
          quality *= 0.6;
          slowFrames = 0;
          seed();
        }
      } else if (slowFrames > 0) {
        slowFrames -= 1;
      }
      context.clearRect(0, 0, width, height);
      context.globalAlpha = preset.opacity;
      const speedScale = height / 1080;
      // Colores del estilo visual activo (lluvia ácida en Cyberpunk, rojo en KITT y Roadster…).
      const palette = weatherFxPalette(visualStyle, document.documentElement.classList.contains("dark"), isDay);

      if (preset.kind === "rain" || preset.kind === "storm") {
        const angle = (preset.angle * Math.PI) / 180;
        const dx = Math.sin(angle);
        const dy = Math.cos(angle);
        if (preset.kind === "storm") {
          context.fillStyle = palette.veil;
          context.fillRect(0, 0, width, height);
        }
        context.strokeStyle = palette.rain;
        context.lineWidth = 1.4;
        context.lineCap = "round";
        context.beginPath();
        for (const drop of particles) {
          const length = (22 + drop.z * 30) * speedScale;
          context.moveTo(drop.x, drop.y);
          context.lineTo(drop.x + dx * length, drop.y + dy * length);
          const v = preset.speed * drop.z * speedScale * dt;
          drop.x += dx * v;
          drop.y += dy * v;
          if (drop.y > height + 20) {
            drop.y = -20;
            drop.x = Math.random() * width - dx * height * 0.5;
          }
          if (drop.x > width + 20) drop.x = -20;
        }
        context.stroke();
        if (preset.flashes) {
          if (now >= flashAt) {
            flashLevel = 0.9;
            flashAt = now + 3_500 + Math.random() * 7_000;
          }
          if (flashLevel > 0.01) {
            context.globalAlpha = flashLevel * 0.5;
            context.fillStyle = palette.flash;
            context.fillRect(0, 0, width, height);
            flashLevel *= Math.pow(0.02, dt * 2.2);
          }
        }
      } else if (preset.kind === "snow") {
        context.fillStyle = palette.snow;
        for (const flake of particles) {
          flake.phase += dt * 1.6;
          const r = 1.2 + flake.z * 2.4;
          context.beginPath();
          context.arc(flake.x, flake.y, r, 0, Math.PI * 2);
          context.fill();
          flake.y += preset.speed * flake.z * speedScale * dt;
          flake.x += (Math.sin(flake.phase) * 18 + preset.angle * 2) * dt;
          if (flake.y > height + 10) {
            flake.y = -10;
            flake.x = Math.random() * width;
          }
          if (flake.x > width + 10) flake.x = -10;
          if (flake.x < -10) flake.x = width + 10;
        }
      } else if (preset.kind === "fog" || preset.kind === "clouds") {
        for (const blob of blobs) {
          const gradient = context.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
          gradient.addColorStop(0, `rgba(${palette.fogTone}, ${blob.a})`);
          gradient.addColorStop(1, `rgba(${palette.fogTone}, 0)`);
          context.fillStyle = gradient;
          context.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
          blob.x += blob.v * dt;
          if (blob.x - blob.r > width) blob.x = -blob.r;
        }
      } else if (preset.kind === "sun") {
        // Luz cálida desde la esquina superior derecha con motas flotando.
        const glow = context.createRadialGradient(width, 0, 0, width, 0, Math.max(width, height) * 0.7);
        glow.addColorStop(0, `rgba(${palette.sunTone}, 0.35)`);
        glow.addColorStop(1, `rgba(${palette.sunTone}, 0)`);
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
        context.fillStyle = palette.mote;
        for (const mote of particles) {
          mote.phase += dt * 0.8;
          context.beginPath();
          context.arc(mote.x, mote.y, 1 + mote.z * 1.6, 0, Math.PI * 2);
          context.fill();
          mote.y -= preset.speed * mote.z * dt;
          mote.x += Math.sin(mote.phase) * 10 * dt;
          if (mote.y < -10) {
            mote.y = height + 10;
            mote.x = Math.random() * width;
          }
        }
      } else if (preset.kind === "stars") {
        context.fillStyle = palette.star;
        for (const star of particles) {
          star.phase += dt * (0.6 + star.z);
          const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(star.phase));
          context.globalAlpha = preset.opacity * twinkle;
          context.beginPath();
          context.arc(star.x, star.y * 0.7, 0.6 + star.z * 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, reduceMotion, preset, isDay, visualStyle]);

  if (!enabled || reduceMotion || !preset || preset.kind === "none") return null;
  return <canvas ref={canvasRef} className="weather-fx" data-kind={preset.kind} aria-hidden />;
}

export type { WeatherFxPreset };
