"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Headphones,
  Heart,
  Music2,
  Pause,
  Play,
  Podcast,
  Radio,
  RefreshCw,
  Settings2,
  SkipBack,
  SkipForward,
  TriangleAlert,
  Unplug,
  Volume2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError, errorMessage } from "@/lib/http";
import { toast } from "@/stores/toast";
import { formatDuration } from "@/lib/utils";
import { SpotifySearch } from "@/features/music/components/spotify-search";
import { SpotifyWebPlayer } from "@/features/music/components/spotify-web-player";
import { ensureSpotifyWebDevice } from "@/features/music/spotify-web-player-bridge";
import { claimPlayback } from "@/features/media/playback-sources";
import { usePreferences } from "@/stores/preferences";

interface MeResponse {
  user: { id: string; email: string } | null;
  accountsAvailable: boolean;
}

interface SpotifyStatus {
  configured: boolean;
  authenticated: boolean;
  connected: boolean;
  streaming?: boolean;
  encrypted?: boolean;
}

interface NowPlaying {
  playing: boolean;
  progressMs: number;
  durationMs: number;
  track: {
    id: string;
    name: string;
    artists: string[];
    album: string | null;
    imageUrl: string | null;
    externalUrl: string | null;
  } | null;
  device: string | null;
  deviceVolume: number | null;
}

export function MusicPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [controlError, setControlError] = React.useState<string | null>(null);
  const [localVolume, setLocalVolume] = React.useState(70);
  const [webDeviceId, setWebDeviceId] = React.useState<string | null>(null);
  const feedbackShown = React.useRef(false);

  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    staleTime: 60_000,
  });

  const status = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => apiFetch<SpotifyStatus>("/api/spotify/status"),
    staleTime: 30_000,
    retry: 0,
  });

  const nowPlaying = useQuery({
    queryKey: ["spotify-now-playing"],
    queryFn: () => apiFetch<NowPlaying>("/api/spotify/now-playing"),
    enabled: Boolean(status.data?.connected),
    refetchInterval: 15_000,
    retry: 0,
  });

  React.useEffect(() => {
    if (nowPlaying.data?.deviceVolume !== null && nowPlaying.data?.deviceVolume !== undefined) {
      setLocalVolume(nowPlaying.data.deviceVolume);
    }
  }, [nowPlaying.data?.deviceVolume]);

  React.useEffect(() => {
    if (feedbackShown.current) return;
    const result = params.get("spotify");
    if (!result) return;
    feedbackShown.current = true;
    if (result === "connected") {
      toast({
        title: "Spotify conectado",
        description: "Ya puedes controlar la reproducción remota desde TECLA LIVE.",
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
    } else if (result === "error") {
      const reason = params.get("reason");
      toast({
        title: "No pudimos conectar Spotify",
        description:
          reason === "not_configured"
            ? "Completa la configuración de Spotify en el servidor."
            : reason === "login_required"
              ? "Inicia sesión en TECLA LIVE antes de vincular Spotify."
              : "La autorización no se completó. Intenta de nuevo.",
        variant: "error",
      });
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("spotify");
    url.searchParams.delete("reason");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [params, queryClient]);

  const control = useMutation({
    mutationFn: async (input: { action: "play" | "pause" | "next" | "previous" | "volume"; volume?: number }) => {
      let deviceId: string | null = null;
      if (input.action === "play") {
        claimPlayback("spotify");
        deviceId = webDeviceId ?? (usePreferences.getState().spotifyWebPlayer ? await ensureSpotifyWebDevice() : null);
      }
      return apiFetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, ...(deviceId ? { deviceId } : {}) }),
      });
    },
    onSuccess: () => {
      setControlError(null);
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["spotify-now-playing"] });
      }, 450);
    },
    onError: (error) => {
      setControlError(errorMessage(error));
    },
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch("/api/spotify/disconnect", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
      queryClient.removeQueries({ queryKey: ["spotify-now-playing"] });
      toast({ title: "Spotify desconectado", description: "Tus tokens se eliminaron del servidor.", variant: "info" });
    },
    onError: (error) => {
      toast({ title: "No pudimos desconectar Spotify", description: errorMessage(error), variant: "error" });
    },
  });

  const configured = status.data?.configured ?? false;
  const connected = status.data?.connected ?? false;
  const signedIn = Boolean(me.data?.user);
  const track = nowPlaying.data?.track ?? null;
  const progress =
    nowPlaying.data && nowPlaying.data.durationMs > 0
      ? Math.min(100, (nowPlaying.data.progressMs / nowPlaying.data.durationMs) * 100)
      : 0;
  const playbackError =
    nowPlaying.error instanceof ApiError ? nowPlaying.error.message : null;

  return (
    <div>
      <PageHeader
        eyebrow="Música"
        title="Tu banda sonora."
        description="Busca y reproduce canciones de Spotify en esta pantalla o en tus dispositivos, radio en vivo y podcasts. Sin simular reproducción."
        actions={
          <>
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Abrir Spotify
              <ExternalLink className="size-3" aria-hidden />
            </a>
            {connected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect.mutate()}
                loading={disconnect.isPending}
              >
                <Unplug className="size-3.5" aria-hidden />
                Desconectar
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          {status.isLoading ? (
            <Skeleton className="min-h-[460px] w-full rounded-[2rem]" />
          ) : !configured ? (
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-[#0a090d] p-6 text-white md:p-9">
              <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_15%_0%,rgba(30,215,96,0.24),transparent_60%),radial-gradient(80%_70%_at_95%_70%,rgba(255,90,60,0.12),transparent_60%)]" />
              <div className="relative max-w-2xl">
                <span className="flex size-16 items-center justify-center rounded-[1.4rem] bg-[#1ed760]/15 text-[#1ed760]">
                  <Music2 className="size-8" aria-hidden />
                </span>
                <h2 className="mt-5 text-display text-3xl md:text-4xl">Spotify está a un paso.</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  Configura las credenciales de Spotify en el servidor para vincular tu cuenta y
                  controlar la reproducción remota. TECLA LIVE nunca recibe tu contraseña de Spotify.
                </p>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-[10px] leading-relaxed text-white/45">
                  SPOTIFY_CLIENT_ID
                  <br />
                  SPOTIFY_CLIENT_SECRET
                  <br />
                  SPOTIFY_REDIRECT_URI
                  <br />
                  TOKEN_ENCRYPTION_KEY
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="/settings"
                    className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-medium text-white/75 hover:bg-white/10"
                  >
                    <Settings2 className="size-3.5" aria-hidden />
                    Ver configuración
                  </Link>
                  <Link
                    href="/radio"
                    className="flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-black"
                  >
                    <Radio className="size-3.5" aria-hidden />
                    Escuchar radio ahora
                  </Link>
                </div>
                <p className="mt-4 text-[10px] leading-relaxed text-white/35">
                  Mientras tanto, radio y podcasts funcionan sin credenciales.
                </p>
              </div>
            </div>
          ) : !connected ? (
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-[#0a090d] p-6 text-white md:p-9">
              <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_15%_0%,rgba(30,215,96,0.2),transparent_60%),radial-gradient(70%_70%_at_95%_20%,rgba(124,58,237,0.18),transparent_60%)]" />
              <div className="relative max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-[#1ed760]/15 text-[#1ed760]">
                    <Music2 className="size-7" aria-hidden />
                  </span>
                  <div>
                    <Badge variant="success">Configurado</Badge>
                    <p className="mt-1 text-[10px] text-white/40">Control remoto de Spotify</p>
                  </div>
                </div>
                <h2 className="mt-5 text-display text-3xl md:text-4xl">Conecta tu cuenta.</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  Autoriza los permisos de reproducción y estado. Los tokens se guardan cifrados en
                  PostgreSQL y nunca se envían al navegador.
                </p>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {signedIn ? (
                    <a
                      href="/api/spotify/login"
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-semibold text-[#04140a] shadow-[0_14px_36px_-16px_rgba(30,215,96,0.8)]"
                    >
                      <Music2 className="size-4" aria-hidden />
                      Vincular Spotify
                    </a>
                  ) : (
                    <Link
                      href="/settings#cuenta"
                      className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black"
                    >
                      Inicia sesión para vincular
                    </Link>
                  )}
                  <Link
                    href="/settings#cuenta"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-xs font-medium text-white/70 hover:bg-white/10"
                  >
                    <Settings2 className="size-3.5" aria-hidden />
                    Gestionar cuenta
                  </Link>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-medium">Qué haremos</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                      Buscar canciones y reproducirlas en esta pantalla (reproductor oficial de
                      Spotify) o en tus otros dispositivos; play/pausa, siguiente, anterior y volumen.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-medium">Qué no haremos</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/45">
                      No guardaremos tu contraseña ni descargaremos audio. Reproducir en esta pantalla
                      requiere Spotify Premium y un navegador con DRM.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[2rem] border border-border bg-[#0a090d] text-white">
              <div className="relative p-6 md:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(100%_90%_at_15%_0%,rgba(30,215,96,0.2),transparent_60%),radial-gradient(80%_80%_at_95%_20%,rgba(255,90,60,0.12),transparent_60%)]" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-[#1ed760]/15 text-[#1ed760]">
                      <Music2 className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[11px] font-medium">Spotify conectado</p>
                      <p className="text-[9px] text-white/40">Control remoto activo</p>
                    </div>
                  </div>
                  <Badge variant="success">En línea</Badge>
                </div>

                {nowPlaying.isLoading ? (
                  <div className="relative mt-8 flex items-center gap-5">
                    <Skeleton className="size-40 rounded-3xl" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-7 w-2/3 rounded-full" />
                      <Skeleton className="h-4 w-1/2 rounded-full" />
                      <Skeleton className="h-3 w-3/4 rounded-full" />
                    </div>
                  </div>
                ) : playbackError ? (
                  <div className="relative mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="flex items-center gap-2 text-xs font-medium text-amber-200/90">
                      <TriangleAlert className="size-4" aria-hidden />
                      Spotify no puede mostrar la reproducción
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{playbackError}</p>
                    <Button
                      variant="glass"
                      size="sm"
                      className="mt-3"
                      onClick={() => void nowPlaying.refetch()}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Reintentar
                    </Button>
                  </div>
                ) : track ? (
                  <div className="relative mt-6 flex flex-col gap-5 sm:flex-row sm:items-end">
                    <div className="relative size-40 shrink-0 overflow-hidden rounded-3xl bg-white/5 shadow-2xl md:size-48">
                      {track.imageUrl ? (
                        <img src={track.imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-gradient-to-br from-[#1ed760]/30 to-[#063a20]">
                          <Music2 className="size-12 text-[#1ed760]" aria-hidden />
                        </div>
                      )}
                      {nowPlaying.data?.playing ? (
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] backdrop-blur">
                          <span className="flex gap-0.5">
                            <span className="wave-bar h-2 w-0.5 bg-[#1ed760]" />
                            <span className="wave-bar h-3 w-0.5 bg-[#1ed760]" style={{ animationDelay: "0.15s" }} />
                            <span className="wave-bar h-2 w-0.5 bg-[#1ed760]" style={{ animationDelay: "0.3s" }} />
                          </span>
                          Sonando
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="eyebrow !text-white/40">
                        {nowPlaying.data?.playing ? "Reproduciendo ahora" : "En pausa"}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight md:text-3xl">
                        {track.name}
                      </h2>
                      <p className="mt-1 text-sm text-white/60">{track.artists.join(", ")}</p>
                      {track.album ? <p className="mt-0.5 text-[11px] text-white/35">{track.album}</p> : null}

                      <div className="mt-5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#1ed760]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between font-mono text-[9px] text-white/35">
                          <span>{formatDuration((nowPlaying.data?.progressMs ?? 0) / 1000)}</span>
                          <span>{formatDuration((nowPlaying.data?.durationMs ?? 0) / 1000)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
                    <Music2 className="mx-auto size-8 text-[#1ed760]" aria-hidden />
                    <p className="mt-3 text-sm font-medium">No hay reproducción activa</p>
                    <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-white/45">
                      Abre Spotify en un dispositivo con sesión iniciada y reproduce algo, o pulsa
                      Play para reanudar en un dispositivo activo.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-4"
                      onClick={() => control.mutate({ action: "play" })}
                      loading={control.isPending}
                    >
                      <Play className="size-3.5 fill-current" aria-hidden />
                      Reproducir en Spotify
                    </Button>
                  </div>
                )}

                {controlError ? (
                  <p className="relative mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-[10px] leading-relaxed text-red-200/80">
                    {controlError}
                  </p>
                ) : null}

                <SpotifyWebPlayer
                  enabled={Boolean(status.data?.streaming)}
                  onDeviceReady={(id) => setWebDeviceId(id)}
                  className="relative mt-6"
                />
                {status.data && !status.data.streaming ? (
                  <p className="relative mt-2 text-[10px] text-amber-200/80">
                    Tu vinculación actual no incluye el permiso de reproducción en el navegador.{" "}
                    <a href="/api/spotify/login" className="underline underline-offset-2">
                      Vuelve a vincular Spotify
                    </a>{" "}
                    para reproducir aquí sin usar el celular.
                  </p>
                ) : null}

                <SpotifySearch
                  webDeviceId={webDeviceId}
                  onPlayed={() => {
                    window.setTimeout(() => {
                      void queryClient.invalidateQueries({ queryKey: ["spotify-now-playing"] });
                    }, 600);
                  }}
                />
              </div>

              <div className="relative border-t border-white/10 bg-black/20 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white/70 hover:bg-white/10"
                      onClick={() => control.mutate({ action: "previous" })}
                      disabled={control.isPending}
                      aria-label="Canción anterior"
                    >
                      <SkipBack className="size-5" />
                    </Button>
                    <Button
                      variant="primary"
                      size="icon-lg"
                      className="rounded-full"
                      onClick={() =>
                        control.mutate({ action: nowPlaying.data?.playing ? "pause" : "play" })
                      }
                      loading={control.isPending}
                      aria-label={nowPlaying.data?.playing ? "Pausar en Spotify" : "Reproducir en Spotify"}
                    >
                      {nowPlaying.data?.playing ? (
                        <Pause className="size-5 fill-current" aria-hidden />
                      ) : (
                        <Play className="ml-0.5 size-5 fill-current" aria-hidden />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white/70 hover:bg-white/10"
                      onClick={() => control.mutate({ action: "next" })}
                      disabled={control.isPending}
                      aria-label="Canción siguiente"
                    >
                      <SkipForward className="size-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Volume2 className="size-4 text-white/50" aria-hidden />
                    <Slider
                      aria-label="Volumen de Spotify"
                      value={[localVolume]}
                      onValueChange={(value) => setLocalVolume(value[0] ?? localVolume)}
                      onValueCommit={(value) =>
                        control.mutate({ action: "volume", volume: value[0] ?? localVolume })
                      }
                      min={0}
                      max={100}
                      step={5}
                      className="w-[130px]"
                      disabled={control.isPending}
                    />
                    <span className="w-8 text-right font-mono text-[9px] text-white/40">
                      {localVolume}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[9px] text-white/35">
                    <span className="size-1.5 rounded-full bg-[#1ed760]" aria-hidden />
                    {nowPlaying.data?.device ?? "Dispositivo activo"}
                  </div>
                </div>
                <p className="mt-3 text-[9px] leading-relaxed text-white/25">
                  Requiere Spotify Premium. Con el reproductor de esta pantalla activo, la música suena
                  aquí mismo; si no, se usa tu dispositivo activo de Spotify.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/radio"
              className="group flex items-center gap-4 rounded-3xl border border-border bg-gradient-to-br from-[#f6b756]/10 via-surface/50 to-surface/40 p-5 transition-colors hover:border-[#f6b756]/30"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f6b756]/15 text-[#f6b756]">
                <Radio className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Radio en vivo</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  Emisoras colombianas, sin cuenta.
                </span>
              </span>
              <ArrowIcon />
            </Link>
            <Link
              href="/podcasts"
              className="group flex items-center gap-4 rounded-3xl border border-border bg-gradient-to-br from-[#ff9a76]/10 via-surface/50 to-surface/40 p-5 transition-colors hover:border-[#ff9a76]/30"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[#ff9a76]/15 text-[#ff9a76]">
                <Podcast className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Podcasts</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  Voces, ideas e historias.
                </span>
              </span>
              <ArrowIcon />
            </Link>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-2">Cómo funciona Spotify</p>
            <ul className="space-y-3 text-[11px] leading-relaxed text-muted">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1ed760]" />
                Tú autorizas la cuenta desde el sitio oficial de Spotify. TECLA LIVE nunca ve tu
                contraseña.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1ed760]" />
                Los tokens se cifran con AES-256-GCM y se guardan en PostgreSQL. No llegan al
                navegador.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1ed760]" />
                Reproducir en esta pantalla usa el reproductor oficial de Spotify (Web Playback SDK).
                Necesitas Spotify Premium.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#1ed760]" />
                TECLA AI solo controla Spotify si la cuenta está vinculada y la API responde. No
                simula reproducción.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-2">Radio y podcasts</p>
            <p className="text-[11px] leading-relaxed text-muted">
              No dependen de Spotify. La radio se reproduce con audio HTML5 y los podcasts con sus
              avances públicos. Si Spotify falla, sigues teniendo música y voz.
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/favorites"
                className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[10px] font-medium text-muted hover:text-foreground"
              >
                <Heart className="size-3" aria-hidden />
                Biblioteca
              </Link>
              <Link
                href="/settings#ia"
                className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[10px] font-medium text-muted hover:text-foreground"
              >
                <Headphones className="size-3" aria-hidden />
                Voz TECLA
              </Link>
            </div>
          </div>

          {connected ? (
            <div className="rounded-3xl border border-border bg-surface/45 p-5">
              <p className="eyebrow mb-2">Sesión</p>
              <p className="text-[11px] leading-relaxed text-muted">
                La conexión se guarda en tu cuenta de TECLA LIVE. Al desconectar se eliminan los
                tokens cifrados del servidor.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-red-400"
                onClick={() => disconnect.mutate()}
                loading={disconnect.isPending}
              >
                <Unplug className="size-3.5" aria-hidden />
                Desconectar Spotify
              </Button>
            </div>
          ) : null}

          {status.isError ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-[10px] leading-relaxed text-amber-500">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              No pudimos consultar el estado de Spotify. La radio y los podcasts siguen disponibles.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return <ExternalLink className="size-4 shrink-0 text-muted transition-colors group-hover:text-foreground" aria-hidden />;
}
