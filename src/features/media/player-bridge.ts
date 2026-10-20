"use client";

export interface PlaybackSnapshot {
  active: boolean;
  kind: "youtube" | "radio" | "podcast" | "iptv" | null;
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

let activeController: MediaController | null = null;

export function registerMediaController(controller: MediaController): () => void {
  activeController = controller;
  return () => {
    if (activeController === controller) activeController = null;
  };
}

export function getMediaController(): MediaController | null {
  return activeController;
}
