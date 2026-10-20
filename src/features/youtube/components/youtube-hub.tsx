"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Play, Search, Sparkles, TrendingUp, TvMinimalPlay } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MediaCard } from "@/components/media/media-card";
import { MediaRow } from "@/components/media/media-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useYouTubeSearch, useYouTubeTrending } from "@/features/youtube/hooks";
import { useAi } from "@/features/ai/store";
import { useLibrary } from "@/stores/library";
import { ApiError } from "@/lib/http";
import type { YouTubeVideo } from "@/types";

const CATEGORIES = ["Tecnología", "Música", "Motor", "Noticias", "Podcasts", "Cocina", "Colombia"];

function toItem(video: YouTubeVideo) {
  return {
    kind: "youtube" as const,
    providerId: video.id,
    title: video.title,
    subtitle: video.channelTitle,
    imageUrl: video.thumbnail,
    href: `/watch/${video.id}`,
    durationSeconds: video.durationSeconds,
    live: video.liveBroadcastContent === "live",
  };
}

function VideoGrid({
  videos,
  loading,
}: {
  videos: YouTubeVideo[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} aria-hidden>
            <Skeleton className="aspect-video w-full rounded-[1.4rem]" />
            <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
            <Skeleton className="mt-2 h-3 w-2/5 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <MediaCard key={video.id} item={toItem(video)} className="w-full" />
      ))}
    </div>
  );
}

export function YouTubeHub() {
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const [input, setInput] = React.useState(initialQuery);
  const [activeQuery, setActiveQuery] = React.useState(initialQuery);
  const addSearch = useLibrary((state) => state.addSearch);
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  const search = useYouTubeSearch(activeQuery, 20, activeQuery.length >= 2);
  const trending = useYouTubeTrending(20);

  const notConfigured =
    (search.error instanceof ApiError && search.error.status === 503) ||
    (trending.error instanceof ApiError && trending.error.status === 503);

  function runSearch(query: string) {
    const clean = query.trim();
    if (clean.length < 2) return;
    setInput(clean);
    setActiveQuery(clean);
    addSearch(clean);
  }

  const videos = activeQuery ? (search.data?.videos ?? []) : (trending.data?.videos ?? []);
  const loading = activeQuery ? search.isLoading : trending.isLoading;
  const error = activeQuery ? search.error : trending.error;

  return (
    <div>
      <PageHeader
        eyebrow="Multimedia"
        title="Videos para el camino."
        description="Busca en YouTube, explora tendencias de Colombia y guarda lo que quieras. Reproducción con el reproductor oficial de YouTube."
        actions={
          <Button
            variant="glass"
            onClick={() => openWithPrompt("Busca un video de tecnología en YouTube.")}
          >
            <Sparkles className="size-4" aria-hidden />
            Pedir a TECLA AI
          </Button>
        }
      />

      <div className="mb-6 rounded-3xl border border-border bg-surface/50 p-4 md:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(input);
          }}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Buscar videos, canales o temas…"
              aria-label="Buscar en YouTube"
              className="h-13 rounded-2xl pl-11"
              enterKeyHint="search"
            />
          </div>
          <Button type="submit" size="lg" className="sm:min-w-32">
            Buscar
          </Button>
        </form>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => runSearch(category)}
              className="min-h-9 shrink-0 rounded-full border border-border px-3.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-foreground"
            >
              {category}
            </button>
          ))}
          {activeQuery ? (
            <button
              type="button"
              onClick={() => {
                setActiveQuery("");
                setInput("");
              }}
              className="min-h-9 shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3.5 text-xs font-medium text-accent"
            >
              Volver a tendencias
            </button>
          ) : null}
        </div>
      </div>

      {notConfigured ? (
        <EmptyState
          icon={TvMinimalPlay}
          title="YouTube aún no está configurado"
          description="El resto de TECLA LIVE funciona. Para habilitar búsquedas, tendencias y metadatos reales, configura YOUTUBE_API_KEY en el servidor."
          className="min-h-[300px]"
        />
      ) : error && !loading ? (
        <EmptyState
          icon={TvMinimalPlay}
          title="No pudimos cargar YouTube"
          description={
            error instanceof ApiError ? error.message : "Intenta de nuevo en un momento."
          }
          className="min-h-[300px]"
          action={
            <Button
              variant="glass"
              onClick={() => {
                if (activeQuery) void search.refetch();
                else void trending.refetch();
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : (
        <section aria-label={activeQuery ? "Resultados de búsqueda" : "Tendencias"}>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5">
                {activeQuery ? (
                  <>
                    <Search className="size-3" aria-hidden /> Resultados
                  </>
                ) : (
                  <>
                    <TrendingUp className="size-3" aria-hidden /> Colombia
                  </>
                )}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {activeQuery ? `“${activeQuery}”` : "Tendencias de hoy"}
              </h2>
            </div>
            {!loading ? (
              <span className="text-[11px] text-muted">
                {videos.length} {videos.length === 1 ? "video" : "videos"}
              </span>
            ) : null}
          </div>

          {!loading && videos.length === 0 ? (
            <EmptyState
              icon={Play}
              title="Sin resultados"
              description="Prueba con otra búsqueda. TECLA AI también puede buscar por ti si le pides un tema."
            />
          ) : (
            <VideoGrid videos={videos} loading={loading} />
          )}
        </section>
      )}

      {!activeQuery && !notConfigured ? (
        <div className="mt-10">
          <MediaRow
            title="Atajos de YouTube"
            subtitle="Búsquedas editoriales para empezar."
          >
            {CATEGORIES.slice(0, 5).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => runSearch(category)}
                className="flex min-h-[118px] w-[210px] shrink-0 snap-start flex-col justify-between rounded-3xl border border-border bg-gradient-to-br from-[#ff3b3b]/15 via-surface to-surface p-4 text-left transition-colors hover:border-[#ff3b3b]/30"
              >
                <TvMinimalPlay className="size-5 text-[#ff6b6b]" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{category}</span>
                  <span className="mt-1 block text-[11px] text-muted">Buscar en YouTube</span>
                </span>
              </button>
            ))}
          </MediaRow>
        </div>
      ) : null}
    </div>
  );
}
