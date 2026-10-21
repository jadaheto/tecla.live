"use client";

export interface PlaybackSnapshot {
  active: boolean;
  kind: "youtube" | "radio" | "podcast" | "iptv" | "drive" | "spotify" | null;
  title: string | null;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  canControl: boolean;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface MediaController {
  getSnapshot: () => PlaybackSnapshot;
  play: () => Promise<ActionResult>;
  pause: () => Promise<ActionResult>;
  next: () => Promise<ActionResult>;
  seek?: (seconds: number) => Promise<ActionResult>;
}

/**
 * Dos niveles de control de medios:
 * - `page`: lo registra la pantalla montada (YouTube, podcasts, IPTV, Drive).
 * - `background`: lo registra el reproductor global de radio/Spotify, que
 *   sigue sonando aunque el usuario cambie de pantalla.
 * TECLA AI usa el de la pantalla, salvo en Drive con música de fondo sonando:
 * ahí «pausa» debe detener la música, no atenuar el motor.
 */
let pageController: MediaController | null = null;
let backgroundController: MediaController | null = null;

export function registerMediaController(controller: MediaController): () => void {
  pageController = controller;
  return () => {
    if (pageController === controller) pageController = null;
  };
}

export function registerBackgroundController(controller: MediaController): () => void {
  backgroundController = controller;
  return () => {
    if (backgroundController === controller) backgroundController = null;
  };
}

export function getPageController(): MediaController | null {
  return pageController;
}

export function getMediaController(): MediaController | null {
  if (!pageController) return backgroundController;
  if (backgroundController && pageController.getSnapshot().kind === "drive") {
    if (backgroundController.getSnapshot().isPlaying) return backgroundController;
  }
  return pageController;
}
