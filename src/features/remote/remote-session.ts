"use client";

import { create } from "zustand";
import type { RemoteScreen } from "@/lib/remote/schema";

export type RemoteSessionStatus = "off" | "connecting" | "online" | "error";

interface RemoteSessionState {
  status: RemoteSessionStatus;
  code: string | null;
  token: string | null;
  error: string | null;
  lastCommand: string | null;
  lastCommandAt: number | null;
  setSession: (patch: Partial<Omit<RemoteSessionState, "setSession">>) => void;
}

/** Estado en memoria de la sala de control remoto del auto. */
export const useRemoteSession = create<RemoteSessionState>()((set) => ({
  status: "off",
  code: null,
  token: null,
  error: null,
  lastCommand: null,
  lastCommandAt: null,
  setSession: (patch) => set(patch),
}));

export const REMOTE_STORAGE_KEY = "tecla-remote-session";

/** Rutas internas a las que puede saltar el celular. */
export const REMOTE_SCREEN_HREF: Record<RemoteScreen, string> = {
  home: "/",
  youtube: "/youtube",
  music: "/music",
  radio: "/radio",
  podcasts: "/podcasts",
  navigate: "/navigate",
  drive: "/drive",
  settings: "/settings",
};

export function remoteUrl(code: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/remote/${code}`;
}

/** Etiqueta corta de una orden para la notificación en el auto. */
export function describeRemoteCommand(command: { type: string; delta?: number; screen?: string; on?: boolean; text?: string; style?: string }): string {
  switch (command.type) {
    case "play":
      return "Reproducir";
    case "pause":
      return "Pausar";
    case "next":
      return "Siguiente";
    case "volume":
      return (command.delta ?? 0) > 0 ? "Subir volumen" : "Bajar volumen";
    case "open":
      return `Abrir ${command.screen ?? ""}`.trim();
    case "ambient":
      return command.on ? "Pantalla ambiente" : "Salir de pantalla ambiente";
    case "ask":
      return `TECLA AI: «${command.text ?? ""}»`;
    case "style":
      return `Estilo ${command.style ?? ""}`.trim();
    default:
      return "Orden";
  }
}
