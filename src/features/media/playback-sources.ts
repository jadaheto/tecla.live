"use client";

import { usePlayer } from "@/stores/player";
import type { PlayerItem } from "@/types";
import { getPageController } from "./player-bridge";

/**
 * Árbitro de reproducción: solo una fuente suena a la vez. La radio y
 * Spotify viven fuera de las páginas (siguen sonando al navegar); cuando el
 * usuario elige otra cosa (YouTube, podcast, IPTV, la otra fuente), la
 * anterior se pausa. Cerrar el reproductor la detiene del todo.
 */
export type BackgroundKind = "radio" | "spotify";

export interface PlaybackSource {
  pause: () => void | Promise<unknown>;
  stop: () => void | Promise<unknown>;
}

const sources = new Map<BackgroundKind, PlaybackSource>();

export function registerPlaybackSource(kind: BackgroundKind, source: PlaybackSource): () => void {
  sources.set(kind, source);
  return () => {
    if (sources.get(kind) === source) sources.delete(kind);
  };
}

function isBackground(kind: string | null | undefined): kind is BackgroundKind {
  return kind === "radio" || kind === "spotify";
}

/** Pausa todo lo que no sea `kind` antes de que esa fuente empiece a sonar. */
export function claimPlayback(kind: PlayerItem["kind"]): void {
  for (const [sourceKind, source] of sources) {
    if (sourceKind !== kind) void Promise.resolve(source.pause()).catch(() => undefined);
  }
  const page = getPageController();
  if (!page) return;
  const snapshot = page.getSnapshot();
  if (snapshot.kind && snapshot.kind !== kind && snapshot.kind !== "drive" && !isBackground(snapshot.kind) && snapshot.isPlaying) {
    void page.pause().catch(() => undefined);
  }
}

let unsubscribe: (() => void) | null = null;

/** Observa el reproductor: al cambiar de fuente pausa la anterior; al cerrarlo la detiene. */
export function startPlaybackArbiter(): () => void {
  if (unsubscribe) return unsubscribe;
  unsubscribe = usePlayer.subscribe((state, previous) => {
    const previousKind = previous.current?.kind;
    const nextKind = state.current?.kind;
    if (!isBackground(previousKind) || previousKind === nextKind) return;
    const source = sources.get(previousKind);
    if (!source) return;
    void Promise.resolve(nextKind ? source.pause() : source.stop()).catch(() => undefined);
  });
  return unsubscribe;
}

export function stopPlaybackArbiter(): void {
  unsubscribe?.();
  unsubscribe = null;
}
