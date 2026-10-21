"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import { Loader2, Maximize2, Music2, Pause, Play, Radio, SkipForward, TvMinimalPlay, X } from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/media/youtube-player";
import { registerMediaController } from "@/features/media/player-bridge";
import { spotifyCommand, useSpotifyWebPlayer } from "@/features/music/spotify-web-player-bridge";
import { pauseRadio, resumeRadio, useRadioAudio } from "@/features/radio/radio-audio";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";
import type { PlayerItem } from "@/types";

const HIDDEN_EVERYWHERE = ["/ai", "/drive"];

/**
 * Minirreproductor flotante. YouTube muestra el video; la radio y Spotify
 * (que siguen sonando al cambiar de pantalla) muestran una barra compacta
 * con portada, título y controles grandes para el Tesla. Se oculta en la
 * página de su propia fuente, en TECLA AI y en Drive (el audio continúa).
 */
export function MiniPlayer({ pathname }: { pathname: string }) {
  const current = usePlayer((state) => state.current);
  if (!current || HIDDEN_EVERYWHERE.includes(pathname)) return null;
  if (current.kind === "youtube") {
    if (pathname.startsWith("/watch/")) return null;
    return <YouTubeMini current={current} />;
  }
  if (current.kind === "radio" && pathname !== "/radio") return <AudioMiniBar current={current} />;
  if (current.kind === "spotify" && pathname !== "/music") return <AudioMiniBar current={current} />;
  return null;
}

function AudioMiniBar({ current }: { current: PlayerItem }) {
  const isPlaying = usePlayer((state) => state.isPlaying);
  const closePlayer = usePlayer((state) => state.closePlayer);
  const radio = useRadioAudio();
  const spotify = useSpotifyWebPlayer();
  const isRadio = current.kind === "radio";
  const loading = isRadio ? radio.loading : false;
  const canControl = isRadio ? Boolean(radio.station) : spotify.ready;
  const [imageFailed, setImageFailed] = React.useState(false);
  const image = !imageFailed && current.imageUrl?.startsWith("https://") ? current.imageUrl : null;
  const Icon = isRadio ? Radio : Music2;

  function toggle() {
    if (isRadio) {
      if (isPlaying) pauseRadio();
      else void resumeRadio();
      return;
    }
    void spotifyCommand(isPlaying ? "pause" : "resume");
  }

  return (
    <aside
      aria-label="Minirreproductor"
      className="fixed bottom-24 left-3 z-[65] w-[300px] overflow-hidden rounded-2xl border border-border bg-[var(--glass-strong)] shadow-[var(--shadow-float)] backdrop-blur-2xl sm:bottom-6 sm:left-6 sm:w-[340px]"
    >
      <div className="flex items-center gap-3 p-2.5">
        <Link
          href={current.href ?? (isRadio ? "/radio" : "/music")}
          aria-label={isRadio ? "Abrir Radio" : "Abrir Música"}
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-accent"
        >
          <Icon className="size-5" aria-hidden />
          {image ? (
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
            {isRadio ? "Radio en vivo" : "Spotify"} · {loading ? "Conectando" : isPlaying ? "Sonando" : "En pausa"}
          </p>
          <p className="truncate text-[12px] font-semibold text-foreground">{current.title}</p>
          {current.subtitle ? <p className="truncate text-[10px] text-muted">{current.subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={!canControl}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity",
            !canControl && "opacity-40",
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : isPlaying ? (
            <Pause className="size-4 fill-current" aria-hidden />
          ) : (
            <Play className="size-4 fill-current" aria-hidden />
          )}
        </button>
        {!isRadio ? (
          <button
            type="button"
            onClick={() => void spotifyCommand("next")}
            disabled={!canControl}
            aria-label="Siguiente canción"
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground", !canControl && "opacity-40")}
          >
            <SkipForward className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={closePlayer}
          aria-label="Cerrar minirreproductor"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

function YouTubeMini({ current }: { current: PlayerItem }) {
  const setPlaying = usePlayer((state) => state.setPlaying);
  const updateCurrent = usePlayer((state) => state.updateCurrent);
  const closePlayer = usePlayer((state) => state.closePlayer);
  const volume = usePreferences((state) => state.volume);
  const handleRef = React.useRef<YouTubePlayerHandle | null>(null);
  const metaRef = React.useRef(current);
  const [playing, setLocalPlaying] = React.useState(false);

  React.useEffect(() => {
    metaRef.current = current;
  }, [current]);

  React.useEffect(() => {
    return registerMediaController({
      getSnapshot: () => ({
        active: true,
        kind: "youtube",
        title: metaRef.current?.title ?? null,
        isPlaying: handleRef.current?.isPlaying() ?? false,
        positionSeconds: handleRef.current?.getCurrentTime() ?? 0,
        durationSeconds: handleRef.current?.getDuration() ?? 0,
        canControl: Boolean(handleRef.current),
      }),
      play: async () => {
        if (!handleRef.current) {
          return { ok: false, message: "El minirreproductor todavía no está listo." };
        }
        handleRef.current.play();
        return { ok: true, message: "Reproducción reanudada." };
      },
      pause: async () => {
        if (!handleRef.current) {
          return { ok: false, message: "El minirreproductor todavía no está listo." };
        }
        handleRef.current.pause();
        return { ok: true, message: "Video pausado." };
      },
      next: async () => {
        const next = usePlayer.getState().queue[0];
        if (!next) return { ok: false, message: "No hay más videos en la cola." };
        usePlayer.getState().playNext();
        return { ok: true, message: "Pasando al siguiente video." };
      },
    });
  }, []);

  return (
    <aside
      aria-label="Minirreproductor"
      className="fixed bottom-24 left-3 z-[65] w-[278px] overflow-hidden rounded-2xl border border-border bg-[var(--glass-strong)] shadow-[var(--shadow-float)] backdrop-blur-2xl sm:bottom-6 sm:left-6 sm:w-[300px]"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <TvMinimalPlay className="size-3.5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted">
          {playing ? "Reproduciendo · " : "Mini reproductor · "}
          <span className="text-foreground">{current.title}</span>
        </span>
        <Link
          href={`/watch/${current.id}`}
          aria-label="Abrir en el reproductor completo"
          className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => {
            closePlayer();
            setPlaying(false);
          }}
          aria-label="Cerrar minirreproductor"
          className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="aspect-video w-full bg-black">
        <YouTubePlayer
          key={current.id}
          videoId={current.id}
          autoPlay
          volume={volume}
          startSeconds={current.positionSeconds ?? 0}
          onReady={(handle) => {
            handleRef.current = handle;
          }}
          onPlayingChange={(next) => {
            setLocalPlaying(next);
            setPlaying(next);
          }}
          onProgress={(position, duration) => {
            updateCurrent({ positionSeconds: position, durationSeconds: duration });
          }}
        />
      </div>
      <div className="flex items-center justify-between bg-surface/40 px-3 py-1.5 text-[9px] text-muted">
        <span>YouTube oficial</span>
        <Link href={`/watch/${current.id}`} className="font-medium text-foreground/80 hover:text-foreground">
          Ver completo
        </Link>
      </div>
    </aside>
  );
}
