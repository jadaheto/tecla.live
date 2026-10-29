"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { estimateProgressMs, type NowPlaying } from "@/features/music/now-playing";
import { usePreferences } from "@/stores/preferences";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface NowPlayingFullProps {
  open: boolean;
  onClose: () => void;
  data: NowPlaying | null | undefined;
  /** Momento (ms) en que se leyó `data`, para estimar el avance entre lecturas. */
  updatedAt: number;
  pending: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

const subscribeNoop = () => () => undefined;

/** `true` solo en el cliente, tras hidratar: el portal necesita `document.body`. */
function useMounted(): boolean {
  return React.useSyncExternalStore(subscribeNoop, () => true, () => false);
}

// Reloj compartido de medio segundo: arranca con el primer suscriptor y se detiene con el último.
let clockTick = 0;
let clockTimer: number | null = null;
const clockListeners = new Set<() => void>();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === null) {
    clockTick = Date.now();
    clockTimer = window.setInterval(() => {
      clockTick = Date.now();
      clockListeners.forEach((fn) => fn());
    }, 500);
  }
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** Marca de tiempo que avanza cada medio segundo mientras la vista está abierta. */
function useClock(active: boolean): number {
  return React.useSyncExternalStore(active ? subscribeClock : subscribeNoop, () => (active ? clockTick : 0), () => 0);
}

/** Hora local en formato 24 h. */
function formatClock(now: number): string {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(now));
}

/**
 * Pantalla completa de «lo que suena» en Spotify: carátula grande, título,
 * artista, avance estimado y controles táctiles enormes, pensada para la
 * pantalla del Tesla. Es solo vista: la reproducción sigue en Spotify.
 */
export function NowPlayingFull({ open, onClose, data, updatedAt, pending, onToggle, onNext, onPrevious }: NowPlayingFullProps) {
  const visualStyle = usePreferences((state) => state.visualStyle);
  const mounted = useMounted();
  const now = useClock(open && mounted);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const track = data?.track ?? null;
  const position = data ? estimateProgressMs(data, updatedAt, now) : 0;
  const percent = data && data.durationMs > 0 ? Math.min(100, (position / data.durationMs) * 100) : 0;
  const playing = data?.playing ?? false;

  return createPortal(
    <div className="np-full" data-style={visualStyle} role="dialog" aria-modal="true" aria-label="Reproduciendo ahora en Spotify">
      {track?.imageUrl ? <div className="np-full__bg" style={{ backgroundImage: `url(${track.imageUrl})` }} aria-hidden /> : null}
      <div className="np-full__veil" aria-hidden />

      <header className="np-full__top">
        <span className="np-full__clock">{formatClock(now)}</span>
        <span className="np-full__device">
          <span className="np-full__dot" aria-hidden />
          Spotify{data?.device ? ` · ${data.device}` : ""}
        </span>
        <button type="button" className="np-full__close" onClick={onClose} aria-label="Salir de pantalla completa">
          <X className="size-5" aria-hidden />
          <span>Salir</span>
        </button>
      </header>

      <div className="np-full__stage">
        <div className="np-full__art">
          {track?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.imageUrl} alt="" />
          ) : (
            <div className="np-full__art-empty">
              <Music2 className="size-16" aria-hidden />
            </div>
          )}
        </div>

        <div className="np-full__info">
          <p className="np-full__eyebrow">{track ? (playing ? "Reproduciendo ahora" : "En pausa") : "Sin reproducción activa"}</p>
          <h2 className="np-full__title">{track?.name ?? "Nada suena por ahora"}</h2>
          <p className="np-full__artist">{track ? track.artists.join(", ") : "Elige algo en Spotify y aparecerá aquí."}</p>
          {track?.album ? <p className="np-full__album">{track.album}</p> : null}

          <div className="np-full__progress" aria-hidden>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="np-full__times">
            <span>{formatDuration(position / 1000)}</span>
            <span>{formatDuration((data?.durationMs ?? 0) / 1000)}</span>
          </div>

          <div className="np-full__controls">
            <button type="button" onClick={onPrevious} disabled={pending} aria-label="Canción anterior" className="np-full__btn">
              <SkipBack className="size-8" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onToggle}
              disabled={pending}
              aria-label={playing ? "Pausar en Spotify" : "Reproducir en Spotify"}
              className={cn("np-full__btn np-full__btn--main", pending && "np-full__btn--busy")}
            >
              {playing ? <Pause className="size-10 fill-current" aria-hidden /> : <Play className="ml-1 size-10 fill-current" aria-hidden />}
            </button>
            <button type="button" onClick={onNext} disabled={pending} aria-label="Canción siguiente" className="np-full__btn">
              <SkipForward className="size-8" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
