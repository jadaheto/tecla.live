"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import {
  ExternalLink,
  Headphones,
  Heart,
  Loader2,
  Pause,
  Play,
  Podcast,
  RefreshCw,
  Search,
  Sparkles,
  SkipBack,
  SkipForward,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePodcastSearch } from "@/features/podcasts/hooks";
import { registerMediaController } from "@/features/media/player-bridge";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { useAi } from "@/features/ai/store";
import { toast } from "@/stores/toast";
import { cn, formatDuration } from "@/lib/utils";
import type { PodcastEpisode } from "@/types";

const DEFAULT_QUERY = "podcast en español";
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function PodcastsPage() {
  const [input, setInput] = React.useState(DEFAULT_QUERY);
  const [query, setQuery] = React.useState(DEFAULT_QUERY);
  const search = usePodcastSearch(query, 20);
  const [selected, setSelected] = React.useState<PodcastEpisode | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [loadingAudio, setLoadingAudio] = React.useState(false);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const selectedRef = React.useRef<PodcastEpisode | null>(null);
  const playingRef = React.useRef(false);
  const lastRecordedRef = React.useRef(0);
  const favorites = useLibrary((state) => state.favorites);
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);
  const recordProgress = useLibrary((state) => state.recordProgress);
  const addSearch = useLibrary((state) => state.addSearch);
  const volume = usePreferences((state) => state.volume);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const openWithPrompt = useAi((state) => state.openWithPrompt);
  const setCurrent = usePlayer((state) => state.setCurrent);
  const setStorePlaying = usePlayer((state) => state.setPlaying);

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  React.useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = Math.min(1, Math.max(0, volume / 100));
  }, [volume]);

  const persistProgress = React.useCallback(
    (position: number, total: number) => {
      if (!selected) return;
      recordProgress({
        kind: "podcast",
        providerId: selected.id,
        title: selected.title,
        subtitle: selected.podcastTitle,
        imageUrl: selected.imageUrl,
        href: "/podcasts",
        positionSeconds: position,
        durationSeconds: total,
      });
    },
    [recordProgress, selected],
  );

  React.useEffect(() => {
    return registerMediaController({
      getSnapshot: () => ({
        active: Boolean(selectedRef.current),
        kind: "podcast",
        title: selectedRef.current?.title ?? null,
        isPlaying: playingRef.current,
        positionSeconds: audioRef.current?.currentTime ?? 0,
        durationSeconds: audioRef.current?.duration ?? 0,
        canControl: Boolean(audioRef.current),
      }),
      play: async () => {
        if (!audioRef.current || !selectedRef.current) {
          return { ok: false, message: "No hay un podcast seleccionado." };
        }
        try {
          await audioRef.current.play();
          return { ok: true, message: "Podcast reanudado." };
        } catch {
          return { ok: false, message: "El navegador bloqueó el audio. Toca reproducir." };
        }
      },
      pause: async () => {
        audioRef.current?.pause();
        return { ok: true, message: "Podcast pausado." };
      },
      next: async () => ({
        ok: false,
        message: "Elige otro episodio desde la lista de podcasts.",
      }),
    });
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  function playEpisode(episode: PodcastEpisode) {
    const audio = audioRef.current;
    if (!audio || !episode.audioUrl) return;
    setSelected(episode);
    setAudioError(null);
    setLoadingAudio(true);
    lastRecordedRef.current = 0;
    setCurrent({
      kind: "podcast",
      id: episode.id,
      title: episode.title,
      subtitle: episode.podcastTitle,
      imageUrl: episode.imageUrl,
      audioUrl: episode.audioUrl,
      href: "/podcasts",
    });
    audio.src = episode.audioUrl;
    audio.playbackRate = speed;
    audio.load();
    void audio
      .play()
      .then(() => setLoadingAudio(false))
      .catch(() => {
        setLoadingAudio(false);
        setAudioError(
          "El navegador bloqueó o no pudo reproducir este avance. Toca reproducir o abre el episodio completo.",
        );
      });
  }

  React.useEffect(() => {
    if (!selected || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: selected.title,
      artist: selected.podcastTitle,
      album: "TECLA LIVE",
      artwork: selected.imageUrl ? [{ src: selected.imageUrl, sizes: "512x512" }] : [],
    });
  }, [selected]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selected) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (!audio.src) {
      playEpisode(selected);
      return;
    }
    setAudioError(null);
    setLoadingAudio(true);
    void audio
      .play()
      .then(() => setLoadingAudio(false))
      .catch(() => {
        setLoadingAudio(false);
        setAudioError("No pudimos reanudar el audio.");
      });
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }

  function changeSpeed(next: number) {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function toggleEpisodeFavorite(episode: PodcastEpisode) {
    const added = toggleFavorite({
      kind: "podcast",
      providerId: episode.id,
      title: episode.title,
      subtitle: episode.podcastTitle,
      imageUrl: episode.imageUrl,
      href: "/podcasts",
    });
    toast({
      title: added ? "Podcast guardado" : "Podcast quitado",
      description: episode.title,
      variant: added ? "success" : "info",
    });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const clean = input.trim();
    if (clean.length < 2) return;
    setQuery(clean);
    addSearch(clean);
  }

  const episodes = search.data?.episodes ?? [];
  const selectedFavorite = selected
    ? favorites.some((favorite) => favorite.kind === "podcast" && favorite.providerId === selected.id)
    : false;

  return (
    <div>
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          setPlaying(true);
          setStorePlaying(true);
          setLoadingAudio(false);
          setAudioError(null);
        }}
        onPause={() => {
          setPlaying(false);
          setStorePlaying(false);
          persistProgress(audioRef.current?.currentTime ?? 0, audioRef.current?.duration ?? 0);
        }}
        onWaiting={() => setLoadingAudio(true)}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          setDuration(audio.duration || 0);
          audio.playbackRate = speed;
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (!audio) return;
          setCurrentTime(audio.currentTime);
          if (audio.currentTime - lastRecordedRef.current >= 10 && audio.duration > 0) {
            lastRecordedRef.current = audio.currentTime;
            persistProgress(audio.currentTime, audio.duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setStorePlaying(false);
          if (audioRef.current) {
            persistProgress(audioRef.current.duration, audioRef.current.duration);
          }
        }}
        onError={() => {
          setPlaying(false);
          setLoadingAudio(false);
          setAudioError(
            "El audio del podcast no se pudo cargar. Puede requerir abrir el episodio completo en el proveedor.",
          );
        }}
      />

      <PageHeader
        eyebrow="Voces"
        title="Podcasts para escuchar."
        description="Búsqueda real en el directorio de iTunes. Reproducimos el avance disponible; el episodio completo se abre en su proveedor."
        actions={
          <Button
            variant="glass"
            size="sm"
            onClick={() => openWithPrompt("Busca un podcast de inteligencia artificial.")}
          >
            <Sparkles className="size-4" aria-hidden />
            Pedir a TECLA AI
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="rounded-3xl border border-border bg-surface/45 p-4 md:p-5">
            <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Tema, podcast o episodio…"
                  aria-label="Buscar podcasts"
                  className="h-12 pl-11"
                />
              </div>
              <Button type="submit" size="lg">
                Buscar
              </Button>
              {query !== DEFAULT_QUERY ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setInput(DEFAULT_QUERY);
                    setQuery(DEFAULT_QUERY);
                  }}
                >
                  Descubrir
                </Button>
              ) : null}
            </form>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {["inteligencia artificial", "historia", "ciencia", "negocios", "vallenato", "tecnología"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                      setQuery(suggestion);
                      addSearch(suggestion);
                    }}
                    className="min-h-9 shrink-0 rounded-full border border-border px-3.5 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="eyebrow">iTunes Podcasts</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">“{query}”</h2>
            </div>
            {!search.isLoading ? (
              <span className="text-[11px] text-muted">{episodes.length} episodios</span>
            ) : null}
          </div>

          {search.isError ? (
            <div className="mt-4">
              <EmptyState
                icon={TriangleAlert}
                title="No pudimos cargar los podcasts"
                description="El directorio de iTunes no respondió. Intenta de nuevo en un momento."
                action={
                  <Button variant="glass" size="sm" onClick={() => void search.refetch()}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : search.isLoading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Podcast}
                title="Sin episodios para esa búsqueda"
                description="Prueba con otro tema. La búsqueda se hace contra el catálogo público de iTunes."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {episodes.map((episode) => {
                const active = selected?.id === episode.id;
                const favorite = favorites.some(
                  (item) => item.kind === "podcast" && item.providerId === episode.id,
                );
                return (
                  <div
                    key={episode.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                      active
                        ? "border-accent/35 bg-accent/[0.05]"
                        : "border-border bg-surface/35 hover:border-border/80",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => (active && playing ? togglePlayback() : playEpisode(episode))}
                      aria-label={
                        active && playing ? `Pausar ${episode.title}` : `Reproducir avance de ${episode.title}`
                      }
                      className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ff9a76]/30 to-[#390916] text-white/80"
                    >
                      {episode.imageUrl ? (
                        <img
                          src={episode.imageUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <Podcast className="size-5" aria-hidden />
                      )}
                      <span className="relative flex size-10 items-center justify-center rounded-full bg-black/55 backdrop-blur">
                        {active && loadingAudio ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : active && playing ? (
                          <Pause className="size-4 fill-current" aria-hidden />
                        ) : (
                          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug">{episode.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{episode.podcastTitle}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-muted">
                        {episode.durationSeconds ? (
                          <span className="font-mono">{formatDuration(episode.durationSeconds)}</span>
                        ) : null}
                        <span>Avance disponible</span>
                        {episode.externalUrl ? (
                          <a
                            href={episode.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-accent hover:underline"
                          >
                            Episodio completo
                            <ExternalLink className="size-2.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleEpisodeFavorite(episode)}
                      aria-label={favorite ? "Quitar de favoritos" : "Guardar podcast"}
                      aria-pressed={favorite}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
                    >
                      <Heart className={cn("size-4", favorite && "fill-red-400 text-red-400")} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-[1.8rem] border border-border bg-[#0a090d] p-5 text-white shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="eyebrow !text-white/60">Reproductor</p>
              <Badge variant="outline" className="border-white/15 text-white/60">
                Avance
              </Badge>
            </div>

            {selected ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                    {selected.imageUrl ? (
                      <img
                        src={selected.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Headphones className="size-7 text-[#ff9a76]" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{selected.title}</p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-white/50">{selected.podcastTitle}</p>
                    <button
                      type="button"
                      onClick={() => toggleEpisodeFavorite(selected)}
                      className={cn(
                        "mt-1.5 flex items-center gap-1 text-[10px]",
                        selectedFavorite ? "text-red-300" : "text-white/45",
                      )}
                    >
                      <Heart className={cn("size-3", selectedFavorite && "fill-current")} aria-hidden />
                      {selectedFavorite ? "Guardado" : "Guardar"}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <Slider
                    aria-label="Posición del podcast"
                    value={[Math.min(currentTime, duration || 0)]}
                    onValueChange={(value) => seek(value[0] ?? 0)}
                    min={0}
                    max={Math.max(duration, 1)}
                    step={1}
                  />
                  <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-white/45">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => seek(Math.max(0, currentTime - 15))}
                    aria-label="Retroceder 15 segundos"
                    className="text-white/70 hover:bg-white/10"
                  >
                    <SkipBack className="size-4" />
                  </Button>
                  <Button
                    variant="primary"
                    size="icon-lg"
                    onClick={togglePlayback}
                    aria-label={playing ? "Pausar podcast" : "Reproducir podcast"}
                    className="rounded-full"
                  >
                    {loadingAudio ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : playing ? (
                      <Pause className="size-5 fill-current" aria-hidden />
                    ) : (
                      <Play className="ml-0.5 size-5 fill-current" aria-hidden />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => seek(Math.min(duration, currentTime + 15))}
                    aria-label="Avanzar 15 segundos"
                    className="text-white/70 hover:bg-white/10"
                  >
                    <SkipForward className="size-4" />
                  </Button>
                </div>

                <div className="mt-4 flex items-center justify-center gap-1">
                  {SPEEDS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => changeSpeed(option)}
                      className={cn(
                        "min-h-8 rounded-full px-2.5 font-mono text-[10px] transition-colors",
                        speed === option
                          ? "bg-white text-black"
                          : "border border-white/15 text-white/55 hover:text-white",
                      )}
                    >
                      {option}×
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2.5">
                  <Volume2 className="size-4 text-white/50" aria-hidden />
                  <Slider
                    aria-label="Volumen del podcast"
                    value={[volume]}
                    onValueChange={(value) => setPreferences({ volume: value[0] ?? volume })}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                </div>

                {audioError ? (
                  <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-[10px] leading-relaxed text-red-200/80">
                    {audioError}
                  </p>
                ) : null}

                {selected.externalUrl ? (
                  <a
                    href={selected.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/15 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/10"
                  >
                    Escuchar episodio completo
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-white/5 text-[#ff9a76]">
                  <Podcast className="size-7" aria-hidden />
                </span>
                <p className="mt-4 text-sm font-medium">Elige un episodio</p>
                <p className="mt-1 max-w-[250px] text-[11px] leading-relaxed text-white/45">
                  Reproducimos el avance público del directorio. Para el episodio completo se abre
                  el enlace oficial del proveedor.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
