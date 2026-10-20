"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  Expand,
  ExternalLink,
  Heart,
  ListPlus,
  Monitor,
  Play,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YouTubePlayer, type YouTubePlayerHandle } from "@/components/media/youtube-player";
import { useYouTubeTrending, useYouTubeVideo } from "@/features/youtube/hooks";
import { registerMediaController } from "@/features/media/player-bridge";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { useAi } from "@/features/ai/store";
import { toast } from "@/stores/toast";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { ApiError } from "@/lib/http";

function formatDate(value?: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Bogota",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function WatchExperience({ videoId }: { videoId: string }) {
  const router = useRouter();
  const videoQuery = useYouTubeVideo(videoId);
  const trending = useYouTubeTrending(12);
  const video = videoQuery.data?.video;
  const [playing, setPlaying] = React.useState(false);
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  const [endedVideoId, setEndedVideoId] = React.useState<string | null>(null);
  const ended = endedVideoId === videoId;
  const stageRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<YouTubePlayerHandle | null>(null);
  const playbackRef = React.useRef({ position: 0, duration: 0 });
  const metaRef = React.useRef({
    title: video?.title ?? "Video de YouTube",
    subtitle: video?.channelTitle ?? "",
    imageUrl: video?.thumbnail ?? "",
  });

  const displayMode = usePreferences((state) => state.displayMode);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const cinematic = displayMode === "cinema";

  const favorites = useLibrary((state) => state.favorites);
  const toggleFavoriteInLibrary = useLibrary((state) => state.toggleFavorite);
  const recordProgress = useLibrary((state) => state.recordProgress);
  const openWithPrompt = useAi((state) => state.openWithPrompt);
  const setCurrent = usePlayer((state) => state.setCurrent);
  const updateCurrent = usePlayer((state) => state.updateCurrent);
  const setQueue = usePlayer((state) => state.setQueue);
  const setStorePlaying = usePlayer((state) => state.setPlaying);
  const queue = usePlayer((state) => state.queue);

  const isFavorite = favorites.some(
    (favorite) => favorite.kind === "youtube" && favorite.providerId === videoId,
  );

  React.useEffect(() => {
    metaRef.current = {
      title: video?.title ?? "Video de YouTube",
      subtitle: video?.channelTitle ?? "",
      imageUrl: video?.thumbnail ?? "",
    };
  }, [video]);

  React.useEffect(() => {
    setCurrent({
      kind: "youtube",
      id: videoId,
      title: "Video de YouTube",
      href: `/watch/${videoId}`,
    });
  }, [videoId, setCurrent]);

  React.useEffect(() => {
    if (!video) return;
    updateCurrent({
      title: video.title,
      subtitle: video.channelTitle,
      imageUrl: video.thumbnail,
      durationSeconds: video.durationSeconds,
      href: `/watch/${videoId}`,
    });
  }, [video, updateCurrent, videoId]);

  const related = React.useMemo(
    () => (trending.data?.videos ?? []).filter((item) => item.id !== videoId).slice(0, 10),
    [trending.data, videoId],
  );

  React.useEffect(() => {
    setQueue(
      related.map((item) => ({
        kind: "youtube" as const,
        id: item.id,
        title: item.title,
        subtitle: item.channelTitle,
        imageUrl: item.thumbnail,
        href: `/watch/${item.id}`,
        durationSeconds: item.durationSeconds,
      })),
    );
  }, [related, setQueue]);

  const goNext = React.useCallback(() => {
    const next = usePlayer.getState().queue[0];
    if (!next) {
      setEndedVideoId(videoId);
      return;
    }
    usePlayer.getState().playNext();
    router.push(next.kind === "youtube" ? `/watch/${next.id}` : "/");
  }, [router, videoId]);

  const goNextRef = React.useRef(goNext);
  React.useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  React.useEffect(() => {
    return registerMediaController({
      getSnapshot: () => ({
        active: true,
        kind: "youtube",
        title: metaRef.current.title,
        isPlaying: handleRef.current?.isPlaying() ?? false,
        positionSeconds: playbackRef.current.position,
        durationSeconds: playbackRef.current.duration,
        canControl: Boolean(handleRef.current),
      }),
      play: async () => {
        if (!handleRef.current) {
          return { ok: false, message: "El reproductor todavía no está listo." };
        }
        handleRef.current.play();
        return { ok: true, message: "Reproducción reanudada." };
      },
      pause: async () => {
        if (!handleRef.current) {
          return { ok: false, message: "No hay un reproductor de YouTube listo." };
        }
        handleRef.current.pause();
        return { ok: true, message: "Video pausado." };
      },
      next: async () => {
        goNextRef.current();
        return { ok: true, message: "Pasando al siguiente video." };
      },
    });
  }, []);

  const onProgress = React.useCallback(
    (position: number, duration: number) => {
      playbackRef.current = { position, duration };
      updateCurrent({ positionSeconds: position, durationSeconds: duration });
      if (!video || !Number.isFinite(duration) || duration <= 0) return;
      recordProgress({
        kind: "youtube",
        providerId: videoId,
        title: video.title,
        subtitle: video.channelTitle,
        imageUrl: video.thumbnail,
        href: `/watch/${videoId}`,
        positionSeconds: position,
        durationSeconds: duration,
      });
    },
    [recordProgress, updateCurrent, video, videoId],
  );

  const onPlayingChange = React.useCallback(
    (nextPlaying: boolean) => {
      setPlaying(nextPlaying);
      setStorePlaying(nextPlaying);
      if (nextPlaying && video) {
        recordProgress({
          kind: "youtube",
          providerId: videoId,
          title: video.title,
          subtitle: video.channelTitle,
          imageUrl: video.thumbnail,
          href: `/watch/${videoId}`,
          positionSeconds: Math.max(1, playbackRef.current.position),
          durationSeconds: playbackRef.current.duration,
        });
      }
    },
    [recordProgress, setStorePlaying, video, videoId],
  );

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await stageRef.current?.requestFullscreen();
    } catch {
      toast({
        title: "Pantalla completa no disponible",
        description: "El navegador bloqueó la acción. Prueba el botón de pantalla completa del navegador.",
        variant: "error",
      });
    }
  }

  function handleFavorite() {
    const added = toggleFavoriteInLibrary({
      kind: "youtube",
      providerId: videoId,
      title: video?.title ?? "Video de YouTube",
      subtitle: video?.channelTitle,
      imageUrl: video?.thumbnail,
      href: `/watch/${videoId}`,
    });
    toast({
      title: added ? "Guardado en favoritos" : "Quitado de favoritos",
      description: added ? video?.title : undefined,
      variant: added ? "success" : "info",
    });
  }

  function askAi() {
    const title = video?.title ?? "este video";
    const channel = video?.channelTitle ? ` del canal ${video.channelTitle}` : "";
    openWithPrompt(
      `Tengo abierto el video «${title}»${channel}. Usando solo los metadatos disponibles, explícame de qué trata y sugiéreme algo relacionado.`,
    );
  }

  function copyLink() {
    void navigator.clipboard
      .writeText(`${window.location.origin}/watch/${videoId}`)
      .then(() => toast({ title: "Enlace copiado", variant: "success" }))
      .catch(() => toast({ title: "No se pudo copiar el enlace", variant: "error" }));
  }

  const metadataError = videoQuery.error;
  const notConfigured =
    metadataError instanceof ApiError && metadataError.status === 503;

  return (
    <div>
      {!cinematic ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/youtube"
              className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:text-foreground"
              aria-label="Volver a YouTube"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <p className="eyebrow">Reproduciendo</p>
              <p className="mt-0.5 line-clamp-1 max-w-[560px] text-sm font-medium">
                {video?.title ?? "Video de YouTube"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="glass" size="sm" onClick={() => setPreferences({ displayMode: "cinema" })}>
              <Monitor className="size-4" aria-hidden />
              Modo cine
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label="Pantalla completa">
              <Expand className="size-5" />
            </Button>
            <Button variant="primary" size="sm" onClick={askAi}>
              <Sparkles className="size-4" aria-hidden />
              Preguntar a TECLA AI
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={
          cinematic
            ? "grid gap-4"
            : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_400px]"
        }
      >
        <div className="min-w-0">
          <div
            ref={stageRef}
            className={
              cinematic
                ? "h-[calc(100dvh-1.5rem)] overflow-hidden rounded-2xl bg-black"
                : "aspect-video max-h-[76vh] w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-black shadow-[var(--shadow-float)]"
            }
          >
            <YouTubePlayer
              key={videoId}
              videoId={videoId}
              autoPlay
              volume={80}
              onReady={(handle) => {
                handleRef.current = handle;
              }}
              onPlayingChange={onPlayingChange}
              onProgress={onProgress}
              onEnded={goNext}
            />
          </div>

          {!cinematic ? (
            <div className="mt-5">
              {notConfigured ? (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Los metadatos de YouTube no están configurados. El reproductor oficial sigue
                    funcionando; añade YOUTUBE_API_KEY para ver título, canal y descripción.
                  </span>
                </div>
              ) : null}

              <section className="rounded-3xl border border-border bg-surface/50 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                      {video?.title ?? "Video de YouTube"}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                      {video?.channelTitle ? (
                        <span className="font-medium text-foreground/85">{video.channelTitle}</span>
                      ) : (
                        <span>YouTube</span>
                      )}
                      {video?.publishedAt ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{formatDate(video.publishedAt)}</span>
                        </>
                      ) : null}
                      {video?.durationSeconds ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="flex items-center gap-1">
                            <Clock3 className="size-3" aria-hidden />
                            {formatDuration(video.durationSeconds)}
                          </span>
                        </>
                      ) : null}
                      {video?.liveBroadcastContent === "live" ? <Badge variant="live">En vivo</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={isFavorite ? "secondary" : "glass"}
                      size="sm"
                      onClick={handleFavorite}
                      aria-pressed={isFavorite}
                    >
                      <Heart
                        className={isFavorite ? "size-4 fill-red-400 text-red-400" : "size-4"}
                        aria-hidden
                      />
                      {isFavorite ? "Guardado" : "Guardar"}
                    </Button>
                    <Button variant="glass" size="sm" onClick={copyLink}>
                      <ExternalLink className="size-4" aria-hidden />
                      Copiar enlace
                    </Button>
                  </div>
                </div>

                {video?.description ? (
                  <div className="mt-4">
                    <p
                      className={
                        descriptionOpen
                          ? "whitespace-pre-line text-sm leading-relaxed text-muted"
                          : "line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-muted"
                      }
                    >
                      {video.description}
                    </p>
                    {video.description.length > 220 ? (
                      <button
                        type="button"
                        onClick={() => setDescriptionOpen((open) => !open)}
                        className="mt-2 flex min-h-9 items-center gap-1 text-xs font-medium text-foreground/80"
                      >
                        {descriptionOpen ? (
                          <>
                            Mostrar menos <ChevronUp className="size-3.5" />
                          </>
                        ) : (
                          <>
                            Mostrar más <ChevronDown className="size-3.5" />
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!video && videoQuery.isLoading ? (
                  <p className="mt-4 text-xs text-muted">Cargando metadatos del video…</p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button variant="subtle" size="sm" onClick={goNext} disabled={queue.length === 0}>
                    <Play className="size-3.5 fill-current" aria-hidden />
                    Siguiente
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!video) {
                        toast({
                          title: "Aún sin metadatos",
                          description: "No puedo añadir el video a una lista sin título. Intenta en unos segundos.",
                          variant: "info",
                        });
                        return;
                      }
                      const first = useLibrary.getState().playlists[0];
                      if (!first) {
                        toast({
                          title: "No tienes listas todavía",
                          description: "Crea una lista desde Favoritos para organizar videos.",
                          variant: "info",
                        });
                        router.push("/favorites");
                        return;
                      }
                      useLibrary.getState().addToPlaylist(first.id, {
                        kind: "youtube",
                        providerId: videoId,
                        title: video.title,
                        subtitle: video.channelTitle,
                        imageUrl: video.thumbnail,
                        href: `/watch/${videoId}`,
                      });
                      toast({
                        title: `Añadido a ${first.name}`,
                        variant: "success",
                      });
                    }}
                  >
                    <ListPlus className="size-3.5" aria-hidden />
                    Añadir a lista
                  </Button>
                  {video ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
                    >
                      Abrir en YouTube
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                  {ended ? (
                    <span className="ml-auto text-[11px] text-muted">
                      El video terminó. La cola está vacía.
                    </span>
                  ) : playing ? (
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-500">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Reproduciendo
                    </span>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>

        {!cinematic ? (
          <aside className="min-w-0" aria-label="A continuación">
            <div className="rounded-3xl border border-border bg-surface/50 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="eyebrow">Cola</p>
                  <h2 className="mt-1 text-base font-semibold">A continuación</h2>
                </div>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] text-muted">
                  {queue.length}
                </span>
              </div>

              {trending.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex gap-3" aria-hidden>
                      <div className="aspect-video w-28 animate-pulse rounded-xl bg-surface" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 w-4/5 animate-pulse rounded bg-surface" />
                        <div className="h-3 w-2/5 animate-pulse rounded bg-surface" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : related.length > 0 ? (
                <div className="space-y-1">
                  {related.map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/watch/${item.id}`}
                      className="group flex gap-3 rounded-2xl p-2 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-surface">
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : null}
                        {item.durationSeconds ? (
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-medium text-white tabular-nums">
                            {formatDuration(item.durationSeconds)}
                          </span>
                        ) : null}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="size-5 fill-white text-white" aria-hidden />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-xs font-medium leading-snug">
                          {item.title}
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-muted">
                          {index === 0 ? "Reproduce a continuación · " : ""}
                          {item.channelTitle}
                        </span>
                        {item.publishedAt ? (
                          <span className="mt-0.5 block text-[10px] text-muted/70">
                            {formatRelativeTime(item.publishedAt)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted">
                  No hay videos relacionados disponibles. Puedes buscar otro en YouTube.
                  {trending.isError ? " (YouTube no está configurado o no respondió)." : ""}
                </div>
              )}

              <Link
                href="/youtube"
                className="mt-3 flex min-h-11 items-center justify-center rounded-2xl border border-border text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                Buscar más videos
              </Link>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
