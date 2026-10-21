"use client";

import * as React from "react";
import { claimPlayback, registerPlaybackSource } from "@/features/media/playback-sources";
import type { MediaController } from "@/features/media/player-bridge";
import { apiFetch, errorMessage } from "@/lib/http";
import { usePlayer } from "@/stores/player";

/**
 * Reproductor web de Spotify (Web Playback SDK oficial) como instancia única
 * fuera de React: el dispositivo «TECLA LIVE» sigue conectado y sonando al
 * cambiar de pantalla. La página Música y el minirreproductor solo leen y
 * controlan este estado. Requiere Premium, permiso `streaming` y DRM.
 */
const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement?: () => Promise<void>;
  addListener: (event: string, callback: (payload: Record<string, unknown>) => void) => void;
  removeListener: (event: string) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

interface SpotifyPlayerCtor {
  new (options: {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }): SpotifyPlayerInstance;
}

declare global {
  interface Window {
    Spotify?: { Player: SpotifyPlayerCtor };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export type SpotifyPlayerStatus = "idle" | "loading" | "ready" | "error";

export interface SpotifyTrackInfo {
  uri: string;
  name: string;
  artists: string[];
  imageUrl: string | null;
}

export interface SpotifyWebPlayerState {
  ready: boolean;
  deviceId: string | null;
  name: string;
  status: SpotifyPlayerStatus;
  message: string | null;
  track: SpotifyTrackInfo | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
}

const EMPTY_STATE: SpotifyWebPlayerState = {
  ready: false,
  deviceId: null,
  name: "TECLA LIVE",
  status: "idle",
  message: null,
  track: null,
  paused: true,
  positionMs: 0,
  durationMs: 0,
};

let state: SpotifyWebPlayerState = EMPTY_STATE;
let player: SpotifyPlayerInstance | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSpotifyWebPlayerState(): SpotifyWebPlayerState {
  return state;
}

export function setSpotifyWebPlayerState(patch: Partial<SpotifyWebPlayerState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribeSpotifyWebPlayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSpotifyWebPlayer(): SpotifyWebPlayerState {
  return React.useSyncExternalStore(subscribeSpotifyWebPlayer, getSpotifyWebPlayerState, () => EMPTY_STATE);
}

function loadSdk(): Promise<SpotifyPlayerCtor> {
  return new Promise((resolve, reject) => {
    if (window.Spotify?.Player) {
      resolve(window.Spotify.Player);
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify?.Player) resolve(window.Spotify.Player);
      else reject(new Error("El SDK de Spotify no se inicializó."));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) return;
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error("No se pudo cargar el reproductor de Spotify."));
    document.head.appendChild(script);
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Extrae la pista actual del estado del SDK sin confiar en su forma exacta. */
function parseTrack(payload: Record<string, unknown>): SpotifyTrackInfo | null {
  const trackWindow = asRecord(payload.track_window);
  const track = asRecord(trackWindow?.current_track);
  if (!track || typeof track.uri !== "string" || typeof track.name !== "string") return null;
  const artists = Array.isArray(track.artists)
    ? track.artists
        .map((artist) => asRecord(artist)?.name)
        .filter((name): name is string => typeof name === "string")
    : [];
  const album = asRecord(track.album);
  const images = Array.isArray(album?.images) ? album.images : [];
  const image = asRecord(images[0])?.url;
  return { uri: track.uri, name: track.name, artists, imageUrl: typeof image === "string" ? image : null };
}

function handleStateChanged(payload: Record<string, unknown> | null): void {
  if (!payload) {
    setSpotifyWebPlayerState({ track: null, paused: true, positionMs: 0, durationMs: 0 });
    const current = usePlayer.getState();
    if (current.current?.kind === "spotify") current.setPlaying(false);
    return;
  }
  const track = parseTrack(payload);
  const paused = payload.paused !== false;
  setSpotifyWebPlayerState({
    track,
    paused,
    positionMs: typeof payload.position === "number" ? payload.position : 0,
    durationMs: typeof payload.duration === "number" ? payload.duration : 0,
  });
  if (!track) return;
  const store = usePlayer.getState();
  const sameTrack = store.current?.kind === "spotify" && store.current.id === track.uri;
  if (!sameTrack && !paused) {
    store.setCurrent({
      kind: "spotify",
      id: track.uri,
      title: track.name,
      subtitle: track.artists.join(", "),
      imageUrl: track.imageUrl ?? undefined,
      href: "/music",
    });
  }
  const after = usePlayer.getState();
  if (after.current?.kind === "spotify" && after.current.id === track.uri) after.setPlaying(!paused);
}

/** Conecta este navegador como dispositivo de Spotify. Idempotente mientras esté listo. */
export async function connectSpotifyPlayer(): Promise<void> {
  if (state.status === "ready" && player) return;
  setSpotifyWebPlayerState({ status: "loading", message: null });
  try {
    const Player = await loadSdk();
    player?.disconnect();
    const instance = new Player({
      name: "TECLA LIVE",
      volume: 0.8,
      getOAuthToken: (callback) => {
        apiFetch<{ accessToken: string }>("/api/spotify/token")
          .then((data) => callback(data.accessToken))
          .catch((error) => {
            setSpotifyWebPlayerState({ status: "error", message: errorMessage(error) });
          });
      },
    });
    instance.addListener("ready", (payload) => {
      const id = typeof payload.device_id === "string" ? payload.device_id : null;
      setSpotifyWebPlayerState({ ready: Boolean(id), deviceId: id, status: id ? "ready" : "error" });
    });
    instance.addListener("not_ready", () => {
      setSpotifyWebPlayerState({ ready: false, deviceId: null, status: "idle" });
    });
    instance.addListener("player_state_changed", (payload) => handleStateChanged(asRecord(payload)));
    const fail = (text: string) => (payload: Record<string, unknown>) => {
      const detail = typeof payload.message === "string" ? ` ${payload.message}` : "";
      setSpotifyWebPlayerState({ ready: false, deviceId: null, status: "error", message: `${text}${detail}` });
    };
    instance.addListener("initialization_error", fail("Este navegador no puede reproducir Spotify (falta DRM/Widevine)."));
    instance.addListener("authentication_error", fail("Spotify rechazó la autorización. Vuelve a vincular tu cuenta."));
    instance.addListener("account_error", fail("Spotify requiere una cuenta Premium para reproducir aquí."));
    instance.addListener("playback_error", fail("Spotify no pudo reproducir."));
    player = instance;
    if (instance.activateElement) await instance.activateElement();
    const connected = await instance.connect();
    if (!connected) {
      setSpotifyWebPlayerState({ status: "error", message: "El reproductor de Spotify no se pudo conectar." });
    }
  } catch (error) {
    setSpotifyWebPlayerState({ status: "error", message: errorMessage(error) });
  }
}

export function disconnectSpotifyPlayer(): void {
  player?.disconnect();
  player = null;
  const store = usePlayer.getState();
  if (store.current?.kind === "spotify") store.closePlayer();
  setSpotifyWebPlayerState({ ...EMPTY_STATE });
}

export type SpotifyPlayerCommand = "pause" | "resume" | "toggle" | "next" | "previous";

export async function spotifyCommand(command: SpotifyPlayerCommand): Promise<{ ok: boolean; message: string }> {
  if (!player || !state.ready) {
    return { ok: false, message: "El reproductor web de Spotify no está activo en esta pantalla." };
  }
  try {
    switch (command) {
      case "pause":
        await player.pause();
        return { ok: true, message: "Spotify en pausa." };
      case "resume":
        claimPlayback("spotify");
        await player.resume();
        return { ok: true, message: "Spotify reanudado." };
      case "toggle":
        if (state.paused) claimPlayback("spotify");
        await player.togglePlay();
        return { ok: true, message: state.paused ? "Spotify reanudado." : "Spotify en pausa." };
      case "next":
        await player.nextTrack();
        return { ok: true, message: "Siguiente canción." };
      case "previous":
        await player.previousTrack();
        return { ok: true, message: "Canción anterior." };
    }
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export const spotifyMediaController: MediaController = {
  getSnapshot: () => ({
    active: Boolean(state.track),
    kind: "spotify",
    title: state.track ? `${state.track.name} · ${state.track.artists.join(", ")}` : null,
    isPlaying: Boolean(state.track) && !state.paused,
    positionSeconds: Math.round(state.positionMs / 1000),
    durationSeconds: Math.round(state.durationMs / 1000),
    canControl: state.ready,
  }),
  play: () => spotifyCommand("resume"),
  pause: () => spotifyCommand("pause"),
  next: () => spotifyCommand("next"),
};

registerPlaybackSource("spotify", {
  pause: () => (state.ready && !state.paused ? spotifyCommand("pause") : undefined),
  stop: () => (state.ready && !state.paused ? spotifyCommand("pause") : undefined),
});
