"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { openAssistant } from "@/features/ai/open-assistant";
import { getMediaController } from "@/features/media/player-bridge";
import { REMOTE_SCREEN_HREF, REMOTE_STORAGE_KEY, describeRemoteCommand, useRemoteSession } from "@/features/remote/remote-session";
import { RemoteCommandSchema, type RemoteSessionResponse, type RemoteState } from "@/lib/remote/schema";
import { apiFetch } from "@/lib/http";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/toast";
import { useUi } from "@/stores/ui";

const STATE_EVERY_MS = 6_000;
const RETRY_MS = 4_000;

/**
 * Lado del auto del control remoto: cuando la preferencia está activa abre
 * una sala en el servidor (o retoma la de esta pestaña), escucha las órdenes
 * del celular por SSE y las ejecuta con los mismos controladores que usa
 * TECLA AI. Publica cada pocos segundos qué suena y en qué pantalla está.
 */
export function RemoteProvider() {
  const enabled = usePreferences((state) => state.remoteControl);
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = React.useRef(pathname);
  React.useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  const execute = React.useCallback(
    async (raw: unknown) => {
      const parsed = RemoteCommandSchema.safeParse(raw);
      if (!parsed.success) return;
      const command = parsed.data;
      useRemoteSession.getState().setSession({ lastCommand: describeRemoteCommand(command), lastCommandAt: Date.now() });
      const prefs = usePreferences.getState();
      switch (command.type) {
        case "play":
          await getMediaController()?.play();
          break;
        case "pause":
          await getMediaController()?.pause();
          break;
        case "next":
          await getMediaController()?.next();
          break;
        case "volume":
          prefs.setPreferences({ volume: Math.max(0, Math.min(100, prefs.volume + command.delta)) });
          break;
        case "open":
          useUi.getState().setAmbientOpen(false);
          router.push(REMOTE_SCREEN_HREF[command.screen]);
          break;
        case "ambient":
          useUi.getState().setAmbientOpen(command.on);
          break;
        case "ask":
          useUi.getState().setAmbientOpen(false);
          openAssistant({ prompt: command.text });
          break;
        case "style":
          prefs.setPreferences({ visualStyle: command.style });
          break;
        default:
          return;
      }
      toast({ title: "Control remoto", description: describeRemoteCommand(command), variant: "info" });
    },
    [router],
  );

  React.useEffect(() => {
    const session = useRemoteSession.getState();
    if (!enabled) {
      session.setSession({ status: "off", code: null, token: null, error: null });
      return;
    }
    let disposed = false;
    let source: EventSource | null = null;
    let retry: number | null = null;
    let stateTimer: number | null = null;

    const publishState = async () => {
      const { code, token } = useRemoteSession.getState();
      if (!code || !token) return;
      const current = usePlayer.getState().current;
      const prefs = usePreferences.getState();
      const body: RemoteState = {
        screen: pathRef.current,
        title: current?.title ?? null,
        subtitle: current?.subtitle ?? null,
        kind: current?.kind ?? null,
        isPlaying: usePlayer.getState().isPlaying,
        volume: Math.round(prefs.volume),
        style: prefs.visualStyle,
        ambient: useUi.getState().ambientOpen,
      };
      try {
        await fetch(`/api/remote/${code}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-remote-token": token },
          body: JSON.stringify(body),
        });
      } catch {
        // Sin red: se reintenta en el siguiente ciclo.
      }
    };

    const connect = async () => {
      if (disposed) return;
      useRemoteSession.getState().setSession({ status: "connecting", error: null });
      let saved: { code?: string; token?: string } = {};
      try {
        saved = JSON.parse(sessionStorage.getItem(REMOTE_STORAGE_KEY) ?? "{}") as { code?: string; token?: string };
      } catch {
        saved = {};
      }
      let room: RemoteSessionResponse;
      try {
        room = await apiFetch<RemoteSessionResponse>("/api/remote/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saved.code && saved.token ? { code: saved.code, token: saved.token } : {}),
        });
      } catch (error) {
        if (disposed) return;
        useRemoteSession.getState().setSession({ status: "error", error: error instanceof Error ? error.message : "No se pudo abrir el control remoto." });
        retry = window.setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (disposed) return;
      try {
        sessionStorage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({ code: room.code, token: room.token }));
      } catch {
        // Sin sessionStorage el código cambia al recargar; aceptable.
      }
      useRemoteSession.getState().setSession({ code: room.code, token: room.token });
      source = new EventSource(`/api/remote/${room.code}/events?token=${room.token}`);
      source.addEventListener("ready", () => {
        useRemoteSession.getState().setSession({ status: "online", error: null });
        void publishState();
      });
      source.addEventListener("command", (event) => {
        try {
          const envelope = JSON.parse((event as MessageEvent<string>).data) as { command: unknown };
          void execute(envelope.command).then(() => publishState());
        } catch {
          // Mensaje corrupto: se ignora.
        }
      });
      source.onerror = () => {
        if (disposed) return;
        // El navegador reintenta solo; si la sala caducó (404), abrimos otra.
        if (source?.readyState === EventSource.CLOSED) {
          source = null;
          useRemoteSession.getState().setSession({ status: "connecting" });
          retry = window.setTimeout(() => void connect(), RETRY_MS);
        } else {
          useRemoteSession.getState().setSession({ status: "connecting" });
        }
      };
    };

    void connect();
    stateTimer = window.setInterval(() => void publishState(), STATE_EVERY_MS);
    const unsubscribePlayer = usePlayer.subscribe(() => void publishState());

    return () => {
      disposed = true;
      source?.close();
      if (retry !== null) window.clearTimeout(retry);
      if (stateTimer !== null) window.clearInterval(stateTimer);
      unsubscribePlayer();
    };
  }, [enabled, execute]);

  return null;
}
