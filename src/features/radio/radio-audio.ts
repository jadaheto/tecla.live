"use client";

import * as React from "react";
import { claimPlayback, registerPlaybackSource } from "@/features/media/playback-sources";
import type { MediaController } from "@/features/media/player-bridge";
import { usePlayer } from "@/stores/player";
import type { RadioStation } from "@/types";

/**
 * Reproductor de radio global. Un único elemento de audio vive fuera del
 * árbol de React, así la emisora sigue sonando al cambiar de pantalla
 * (Inicio, Drive, Ajustes…). La página Radio y el minirreproductor solo
 * muestran y controlan este estado.
 */
export interface RadioAudioState {
  station: RadioStation | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: RadioAudioState = { station: null, playing: false, loading: false, error: null };
let state: RadioAudioState = EMPTY_STATE;
let audio: HTMLAudioElement | null = null;
let volumeLevel = 0.8;
const listeners = new Set<() => void>();

function patch(next: Partial<RadioAudioState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function syncStorePlaying(playing: boolean): void {
  const player = usePlayer.getState();
  if (player.current?.kind === "radio") player.setPlaying(playing);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "none";
  audio.volume = volumeLevel;
  audio.addEventListener("playing", () => {
    patch({ playing: true, loading: false, error: null });
    syncStorePlaying(true);
  });
  audio.addEventListener("pause", () => {
    patch({ playing: false, loading: false });
    syncStorePlaying(false);
  });
  audio.addEventListener("waiting", () => patch({ loading: true }));
  audio.addEventListener("error", () => {
    patch({
      playing: false,
      loading: false,
      error: "La emisora no respondió. Puede estar fuera de línea o usar un formato no compatible con este navegador.",
    });
    syncStorePlaying(false);
  });
  return audio;
}

export function getRadioAudioState(): RadioAudioState {
  return state;
}

export function subscribeRadioAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRadioAudio(): RadioAudioState {
  return React.useSyncExternalStore(subscribeRadioAudio, getRadioAudioState, () => EMPTY_STATE);
}

export function setRadioVolume(percent: number): void {
  volumeLevel = Math.min(1, Math.max(0, percent / 100));
  if (audio) audio.volume = volumeLevel;
}

/** Sintoniza y reproduce. Devuelve false si el navegador retuvo el autoplay. */
export async function playRadioStation(station: RadioStation): Promise<boolean> {
  const element = getAudio();
  if (!element) return false;
  claimPlayback("radio");
  patch({ station, error: null, loading: true });
  usePlayer.getState().setCurrent({
    kind: "radio",
    id: station.id,
    title: station.name,
    subtitle: station.tags?.join(" · "),
    imageUrl: station.favicon,
    href: `/radio?station=${encodeURIComponent(station.id)}`,
  });
  if (element.src !== station.url) {
    element.src = station.url;
    element.load();
  }
  try {
    await element.play();
    return true;
  } catch (error) {
    // Cambiar de emisora aborta el play() anterior: no es un error que mostrar.
    if (state.station?.id !== station.id || isAbort(error)) return false;
    patch({
      loading: false,
      error: "El navegador bloqueó o no pudo reproducir la emisora. Toca el botón de reproducir o abre el enlace directo.",
    });
    usePlayer.getState().setPlaybackBlocked(true);
    return false;
  }
}

export async function resumeRadio(): Promise<boolean> {
  const element = getAudio();
  if (!element || !state.station) return false;
  if (!element.src) return playRadioStation(state.station);
  claimPlayback("radio");
  const player = usePlayer.getState();
  if (player.current?.kind !== "radio" || player.current.id !== state.station.id) {
    return playRadioStation(state.station);
  }
  patch({ error: null, loading: true });
  try {
    await element.play();
    return true;
  } catch (error) {
    if (isAbort(error)) return false;
    patch({ loading: false, error: "No pudimos reanudar la emisora. Prueba otra estación." });
    return false;
  }
}

export function pauseRadio(): void {
  audio?.pause();
  if (state.playing || state.loading) patch({ playing: false, loading: false });
}

export function stopRadio(): void {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  patch({ station: null, playing: false, loading: false, error: null });
}

export const radioMediaController: MediaController = {
  getSnapshot: () => ({
    active: Boolean(state.station),
    kind: "radio",
    title: state.station?.name ?? null,
    isPlaying: state.playing,
    positionSeconds: 0,
    durationSeconds: 0,
    canControl: Boolean(state.station),
  }),
  play: async () => {
    if (!state.station) return { ok: false, message: "No hay una emisora seleccionada." };
    const ok = await resumeRadio();
    return ok ? { ok: true, message: "Emisora reanudada." } : { ok: false, message: "El navegador bloqueó el audio. Toca reproducir." };
  },
  pause: async () => {
    pauseRadio();
    return { ok: true, message: "Emisora pausada." };
  },
  next: async () => ({ ok: false, message: "La radio en vivo no tiene una cola. Elige otra emisora en la lista." }),
};

registerPlaybackSource("radio", { pause: pauseRadio, stop: stopRadio });
