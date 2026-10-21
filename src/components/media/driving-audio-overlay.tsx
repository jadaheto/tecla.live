"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { Pause, Play, SkipForward, TvMinimalPlay } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Capa de «modo conducción» sobre el reproductor de YouTube.
 *
 * El navegador del Tesla bloquea el video cuando el carro no está en Park y
 * deja solo el audio. Esta capa no evita esa restricción: muestra una
 * carátula estática, el título y controles grandes para que la pantalla no
 * quede negra mientras el audio continúa.
 */
export function DrivingAudioOverlay({
  videoId,
  title,
  subtitle,
  imageUrl,
  playing,
  positionSeconds,
  durationSeconds,
  onTogglePlay,
  onNext,
  onShowVideo,
  className,
}: {
  videoId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  playing: boolean;
  positionSeconds: number;
  durationSeconds: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onShowVideo: () => void;
  className?: string;
}) {
  const [coverFailed, setCoverFailed] = React.useState(false);
  const cover = coverFailed
    ? imageUrl
    : `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`;
  const progress =
    durationSeconds > 0 ? Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100)) : 0;

  return (
    <div
      className={cn("absolute inset-0 z-10 overflow-hidden rounded-[inherit] bg-[#05070b] text-white", className)}
      role="region"
      aria-label="Modo conducción: solo audio"
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          onError={() => setCoverFailed(true)}
          className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.35),rgba(5,7,11,0.85))]" />

      <div className="relative flex size-full flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="relative size-40 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl sm:size-52">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <TvMinimalPlay className="size-12 text-white/60" aria-hidden />
            </div>
          )}
          {playing ? (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]">
              <span className="flex gap-0.5">
                <span className="wave-bar h-2 w-0.5 bg-[#ff5a3c]" />
                <span className="wave-bar h-3 w-0.5 bg-[#ff5a3c]" style={{ animationDelay: "0.15s" }} />
                <span className="wave-bar h-2 w-0.5 bg-[#ff5a3c]" style={{ animationDelay: "0.3s" }} />
              </span>
              Sonando
            </span>
          ) : null}
        </div>

        <div className="max-w-[640px]">
          <p className="eyebrow !text-white/50">Modo conducción · solo audio</p>
          <h2 className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/60">{subtitle}</p> : null}
        </div>

        <div className="w-full max-w-[520px]">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#ff5a3c] transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-white/45">
            <span>{formatDuration(positionSeconds)}</span>
            <span>{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? "Pausar" : "Reproducir"}
            className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-[0_18px_40px_-16px_rgba(255,255,255,0.7)]"
          >
            {playing ? <Pause className="size-7 fill-current" aria-hidden /> : <Play className="ml-1 size-7 fill-current" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Siguiente"
            className="flex size-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"
          >
            <SkipForward className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onShowVideo}
            className="flex min-h-14 items-center gap-2 rounded-full border border-white/15 bg-black/40 px-5 text-sm font-semibold text-white/85"
          >
            <TvMinimalPlay className="size-4" aria-hidden />
            Ver video
          </button>
        </div>

        <p className="max-w-[520px] text-[10px] leading-relaxed text-white/40">
          El Tesla no muestra video mientras el carro está en marcha; el audio sigue. Al estacionar, toca «Ver video».
        </p>
      </div>
    </div>
  );
}
