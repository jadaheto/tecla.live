"use client";

import * as React from "react";
import Link from "next/link";
import { Maximize2, TvMinimalPlay, X } from "lucide-react";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/media/youtube-player";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { registerMediaController } from "@/features/media/player-bridge";

export function MiniPlayer() {
  const current = usePlayer((state) => state.current);
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
    if (!current || current.kind !== "youtube") return;
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
  }, [current]);

  if (!current || current.kind !== "youtube") return null;

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
