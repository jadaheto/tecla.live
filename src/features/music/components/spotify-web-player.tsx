"use client";

import * as React from "react";
import { MonitorSpeaker, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  connectSpotifyPlayer,
  disconnectSpotifyPlayer,
  useSpotifyWebPlayer,
} from "@/features/music/spotify-web-player-bridge";

/**
 * Convierte este navegador en un dispositivo de Spotify («TECLA LIVE») con el
 * Web Playback SDK oficial. La conexión vive en el puente global: al salir de
 * Música el dispositivo sigue activo y la música no se corta.
 */
export function SpotifyWebPlayer({
  enabled,
  onDeviceReady,
  className,
}: {
  enabled: boolean;
  onDeviceReady?: (deviceId: string) => void;
  className?: string;
}) {
  const { status, message, deviceId, track, paused } = useSpotifyWebPlayer();
  const readyRef = React.useRef(onDeviceReady);

  React.useEffect(() => {
    readyRef.current = onDeviceReady;
  }, [onDeviceReady]);

  React.useEffect(() => {
    if (deviceId) readyRef.current?.(deviceId);
  }, [deviceId]);

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              status === "ready" ? "bg-[#1ed760]/20 text-[#1ed760]" : "bg-white/10 text-white/60",
            )}
          >
            <MonitorSpeaker className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-semibold">Reproducir en esta pantalla</p>
            <p className="text-[10px] text-white/45">
              {status === "ready"
                ? "TECLA LIVE aparece como dispositivo de Spotify. Lo que elijas sigue sonando aunque cambies de pantalla."
                : status === "loading"
                  ? "Conectando el reproductor de Spotify…"
                  : enabled
                    ? "Convierte este navegador en un dispositivo de Spotify (Premium)."
                    : "Vuelve a vincular Spotify para autorizar la reproducción aquí."}
            </p>
          </div>
        </div>
        {status === "ready" ? (
          <Button variant="ghost" size="sm" onClick={disconnectSpotifyPlayer}>
            Desactivar
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void connectSpotifyPlayer()}
            loading={status === "loading"}
            disabled={!enabled}
          >
            Activar reproductor
          </Button>
        )}
      </div>
      {message ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] leading-relaxed text-amber-100/85">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ) : null}
      {deviceId ? (
        <p className="mt-2 text-[9px] text-white/30">
          Dispositivo activo en este navegador
          {track ? ` · ${paused ? "En pausa" : "Sonando"}: ${track.name}` : ""}.
        </p>
      ) : null}
    </div>
  );
}
