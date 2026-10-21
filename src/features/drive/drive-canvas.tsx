"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DriveSceneId } from "./drive-config";
import { DriveSceneRenderer } from "./scene-renderer";

export interface DriveCanvasFrame {
  speedKmh: number;
  speedFactor: number;
}

/**
 * Lienzo de TECLA DRIVE. La simulación escribe en `frameRef` cada cuadro y
 * el renderizador lo lee sin pasar por el estado de React (60 fps estables).
 */
export function DriveCanvas({
  scene,
  frameRef,
  rendererRef,
  lowDetail = false,
  onAutoLowDetail,
  className,
}: {
  scene: DriveSceneId;
  frameRef: React.RefObject<DriveCanvasFrame>;
  rendererRef: React.RefObject<DriveSceneRenderer | null>;
  /** Modo rendimiento: DPR 1 y menos objetos/partículas. */
  lowDetail?: boolean;
  /** Se llama una vez si los fps caen por debajo de 38 durante 3 s y se baja el detalle solo. */
  onAutoLowDetail?: () => void;
  className?: string;
}) {
  const autoLowRef = React.useRef(onAutoLowDetail);
  React.useEffect(() => {
    autoLowRef.current = onAutoLowDetail;
  }, [onAutoLowDetail]);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const lowDetailRef = React.useRef(lowDetail);

  React.useEffect(() => {
    rendererRef.current?.setScene(scene);
  }, [scene, rendererRef]);

  React.useEffect(() => {
    lowDetailRef.current = lowDetail;
    const renderer = rendererRef.current;
    if (renderer) renderer.lowDetail = lowDetail;
    window.dispatchEvent(new Event("resize"));
  }, [lowDetail, rendererRef]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const renderer = new DriveSceneRenderer(context);
    renderer.setScene(scene);
    renderer.lowDetail = lowDetailRef.current;
    rendererRef.current = renderer;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();
    let hidden = document.hidden;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const dpr = lowDetailRef.current ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.resize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    window.addEventListener("resize", resize);

    let fpsFrames = 0;
    let fpsSince = performance.now();
    let autoLowered = false;
    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1_000) || 0.016;
      last = now;
      if (!hidden) {
        const input = frameRef.current;
        renderer.render(input.speedFactor, input.speedKmh, dt, reducedMotion);
        fpsFrames += 1;
        if (now - fpsSince >= 3_000) {
          const fps = (fpsFrames * 1_000) / (now - fpsSince);
          fpsFrames = 0;
          fpsSince = now;
          if (fps < 38 && !lowDetailRef.current && !autoLowered) {
            autoLowered = true;
            lowDetailRef.current = true;
            renderer.lowDetail = true;
            resize();
            autoLowRef.current?.();
          }
        }
      }
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    const onVisibility = () => {
      hidden = document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
    // El renderizador vive mientras exista el canvas; la escena se cambia aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={cn("absolute inset-0 size-full", className)} />;
}
