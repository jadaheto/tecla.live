"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Music2, Play, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorMessage } from "@/lib/http";
import { claimPlayback } from "@/features/media/playback-sources";
import { ensureSpotifyWebDevice } from "@/features/music/spotify-web-player-bridge";
import { usePreferences } from "@/stores/preferences";
import { cn, formatDuration } from "@/lib/utils";
import { toast } from "@/stores/toast";

interface TrackResult {
  uri: string;
  id: string;
  name: string;
  artists: string[];
  album: string | null;
  imageUrl: string | null;
  durationMs: number;
}

interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export function SpotifySearch({
  webDeviceId,
  onPlayed,
}: {
  webDeviceId: string | null;
  onPlayed?: () => void;
}) {
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [targetDevice, setTargetDevice] = React.useState<string | "auto">("auto");

  const results = useQuery({
    queryKey: ["spotify-search", query],
    queryFn: () =>
      apiFetch<{ query: string; tracks: TrackResult[] }>(
        `/api/spotify/search?q=${encodeURIComponent(query)}&limit=8`,
      ),
    enabled: query.length >= 2,
    staleTime: 60_000,
    retry: 0,
  });

  const devices = useQuery({
    queryKey: ["spotify-devices"],
    queryFn: () => apiFetch<{ devices: Device[] }>("/api/spotify/devices"),
    refetchInterval: 30_000,
    retry: 0,
  });

  const play = useMutation({
    mutationFn: async (track: TrackResult) => {
      // «Auto» prefiere esta pantalla: si el reproductor web se activó alguna vez (o ya está
      // listo), se conecta ahora mismo aprovechando el toque del usuario y se reproduce aquí.
      let deviceId: string | null = targetDevice !== "auto" ? targetDevice : webDeviceId;
      const hasActiveDevice = (devices.data?.devices ?? []).some((device) => device.isActive);
      if (targetDevice === "auto" && !deviceId && (usePreferences.getState().spotifyWebPlayer || !hasActiveDevice)) {
        deviceId = await ensureSpotifyWebDevice();
      }
      return apiFetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", uri: track.uri, ...(deviceId ? { deviceId } : {}) }),
      });
    },
    onSuccess: (_, track) => {
      claimPlayback("spotify");
      toast({ title: "Reproduciendo en Spotify", description: `${track.name} · ${track.artists.join(", ")}`, variant: "success" });
      onPlayed?.();
    },
    onError: (error) => {
      toast({ title: "Spotify no pudo reproducir", description: errorMessage(error), variant: "error" });
    },
  });

  const deviceList = devices.data?.devices ?? [];

  return (
    <div className="relative mt-6 rounded-3xl border border-white/10 bg-black/25 p-4 md:p-5">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Busca una canción, artista o álbum en Spotify"
            aria-label="Buscar en Spotify"
            className="h-12 border-white/15 bg-white/5 pl-10 text-sm text-white placeholder:text-white/35"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="primary" className="h-12 px-5" disabled={input.trim().length < 2}>
          Buscar
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/50">
        <Smartphone className="size-3.5" aria-hidden />
        <span>Reproducir en:</span>
        <select
          aria-label="Dispositivo de Spotify"
          value={targetDevice}
          onChange={(event) => setTargetDevice(event.target.value)}
          className="min-h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-[11px] text-white focus-visible:outline-none"
        >
          <option value="auto">{webDeviceId ? "Esta pantalla (TECLA LIVE)" : "Dispositivo activo"}</option>
          {deviceList.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
              {device.isActive ? " · activo" : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void devices.refetch()} className="underline-offset-2 hover:underline">
          Actualizar
        </button>
        {!webDeviceId && deviceList.length === 0 && !devices.isLoading ? (
          <span className="text-amber-200/80">
            Sin dispositivos: activa el reproductor de esta pantalla o abre Spotify en otro dispositivo.
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-1.5">
        {results.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-2xl" />)
        ) : results.isError ? (
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-100/85">
            {errorMessage(results.error)}
          </p>
        ) : results.data && results.data.tracks.length === 0 ? (
          <p className="p-3 text-[11px] text-white/50">Spotify no encontró resultados para «{results.data.query}».</p>
        ) : (
          (results.data?.tracks ?? []).map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-2 pr-3"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
                {track.imageUrl ? (
                  <img src={track.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Music2 className="size-5 text-[#1ed760]" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{track.name}</span>
                <span className="block truncate text-[10px] text-white/50">
                  {track.artists.join(", ")}
                  {track.album ? ` · ${track.album}` : ""}
                </span>
              </span>
              <span className="hidden font-mono text-[10px] text-white/35 sm:block">
                {formatDuration(track.durationMs / 1000)}
              </span>
              <Button
                variant="primary"
                size="sm"
                className={cn("min-h-11 rounded-full px-4", play.isPending && play.variables?.id === track.id && "opacity-70")}
                onClick={() => play.mutate(track)}
                disabled={play.isPending}
                aria-label={`Reproducir ${track.name}`}
              >
                <Play className="size-3.5 fill-current" aria-hidden />
                Reproducir
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
