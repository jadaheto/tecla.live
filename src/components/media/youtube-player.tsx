"use client";

import * as React from "react";
import { CirclePlay, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (id: string) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: string | HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      youtubeApiPromise = null;
      reject(new Error("YOUTUBE_API_TIMEOUT"));
    }, 12_000);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else {
        youtubeApiPromise = null;
        reject(new Error("YOUTUBE_API_UNAVAILABLE"));
      }
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        reject(new Error("YOUTUBE_API_LOAD_FAILED"));
      };
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
}

function friendlyError(code: number): string {
  switch (code) {
    case 2:
      return "El identificador del video no es válido.";
    case 5:
      return "Este navegador no puede reproducir el video con el reproductor de YouTube.";
    case 100:
      return "El video no existe o es privado.";
    case 101:
    case 150:
      return "El propietario no permite reproducir este video fuera de YouTube.";
    default:
      return "No pudimos reproducir este video.";
  }
}

export function YouTubePlayer({
  videoId,
  autoPlay = false,
  volume = 80,
  startSeconds = 0,
  onReady,
  onPlayingChange,
  onProgress,
  onEnded,
}: {
  videoId: string;
  autoPlay?: boolean;
  volume?: number;
  startSeconds?: number;
  onReady?: (handle: YouTubePlayerHandle | null) => void;
  onPlayingChange?: (playing: boolean) => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YTPlayer | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const callbackRef = React.useRef({ onReady, onPlayingChange, onProgress, onEnded, volume, autoPlay, startSeconds });

  React.useEffect(() => {
    callbackRef.current = { onReady, onPlayingChange, onProgress, onEnded, volume, autoPlay, startSeconds };
  }, [onReady, onPlayingChange, onProgress, onEnded, volume, autoPlay, startSeconds]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let progressTimer: number | undefined;
    let gestureTimer: number | undefined;

    // YouTube reemplaza el elemento que recibe por su propio iframe. Ese nodo
    // debe quedar fuera del árbol que React reconcilia; si no, React intenta
    // eliminar un hijo que YouTube ya reemplazó y lanza removeChild.
    const target = document.createElement("div");
    host.replaceChildren(target);

    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        const player = new YT.Player(target, {
          videoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
            ...(callbackRef.current.startSeconds > 0
              ? { start: Math.floor(callbackRef.current.startSeconds) }
              : {}),
          },
          events: {
            onReady: () => {
              if (disposed) return;
              setReady(true);
              player.setVolume(callbackRef.current.volume);
              callbackRef.current.onReady?.({
                play: () => player.playVideo(),
                pause: () => player.pauseVideo(),
                getCurrentTime: () => player.getCurrentTime(),
                getDuration: () => player.getDuration(),
                isPlaying: () => player.getPlayerState() === 1,
              });
              if (callbackRef.current.autoPlay) {
                try {
                  player.playVideo();
                } catch {
                  setNeedsGesture(true);
                }
                gestureTimer = window.setTimeout(() => {
                  if (player.getPlayerState() !== 1) setNeedsGesture(true);
                }, 2600);
              }
            },
            onStateChange: (event) => {
              const state = event.data;
              callbackRef.current.onPlayingChange?.(state === 1);
              if (state === 1) {
                setNeedsGesture(false);
                if (gestureTimer) window.clearTimeout(gestureTimer);
                if (!progressTimer) {
                  progressTimer = window.setInterval(() => {
                    callbackRef.current.onProgress?.(
                      player.getCurrentTime(),
                      player.getDuration(),
                    );
                  }, 5000);
                }
              } else {
                if (progressTimer) {
                  window.clearInterval(progressTimer);
                  progressTimer = undefined;
                }
                callbackRef.current.onProgress?.(
                  player.getCurrentTime(),
                  player.getDuration(),
                );
                if (state === 0) callbackRef.current.onEnded?.();
              }
            },
            onError: (event) => {
              setError(friendlyError(event.data));
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!disposed) setError("No pudimos cargar el reproductor de YouTube.");
      });

    return () => {
      disposed = true;
      if (progressTimer) window.clearInterval(progressTimer);
      if (gestureTimer) window.clearTimeout(gestureTimer);
      callbackRef.current.onReady?.(null);
      try {
        playerRef.current?.destroy();
      } catch {
        // El iframe ya pudo haberse desmontado.
      }
      playerRef.current = null;
      // Este hijo lo crea y lo administra YouTube, no React.
      host.replaceChildren();
    };
  }, [videoId, autoPlay]);

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-3xl border border-border bg-black/40 p-6 text-center">
        <TriangleAlert className="size-8 text-amber-400" aria-hidden />
        <p className="max-w-md text-sm text-white/80">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="glass" size="sm" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-4 text-xs font-medium text-white"
          >
            Abrir en YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-full overflow-hidden rounded-[1.6rem] bg-black">
      <div ref={hostRef} className="size-full [&>iframe]:size-full" />

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <span className="size-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      ) : null}

      {needsGesture ? (
        <div className="absolute inset-x-0 bottom-20 flex justify-center">
          <Button variant="primary" size="lg" onClick={() => playerRef.current?.playVideo()}>
            <CirclePlay className="size-5" aria-hidden />
            Reproducir con sonido
          </Button>
        </div>
      ) : null}
    </div>
  );
}
