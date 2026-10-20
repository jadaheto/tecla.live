"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  Heart,
  Play,
  Podcast,
  Radio,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MediaCard } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useYouTubeSearch } from "@/features/youtube/hooks";
import { useRadioStations } from "@/features/radio/hooks";
import { usePodcastSearch } from "@/features/podcasts/hooks";
import { useLibrary } from "@/stores/library";
import { useAi } from "@/features/ai/store";
import { APPS } from "@/lib/catalog";
import { toast } from "@/stores/toast";
import { cn, formatDuration, truncate } from "@/lib/utils";

export function SearchExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const [input, setInput] = React.useState(query);
  const searches = useLibrary((state) => state.searches);
  const addSearch = useLibrary((state) => state.addSearch);
  const favorites = useLibrary((state) => state.favorites);
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  const youtube = useYouTubeSearch(query, 20, query.length >= 2);
  const radio = useRadioStations(query, 12, query.length >= 2);
  const podcasts = usePodcastSearch(query, 8);

  React.useEffect(() => setInput(query), [query]);

  const apps = React.useMemo(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    return APPS.filter(
      (app) =>
        app.name.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle),
    );
  }, [query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = input.trim();
    if (clean.length < 2) return;
    addSearch(clean);
    router.push(`/search?q=${encodeURIComponent(clean)}`);
  }

  const hasAnyResults =
    apps.length > 0 ||
    (youtube.data?.videos.length ?? 0) > 0 ||
    (radio.data?.stations.length ?? 0) > 0 ||
    (podcasts.data?.episodes.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Búsqueda universal"
        title={query ? `Resultados para “${truncate(query, 40)}”` : "¿Qué quieres encontrar?"}
        description="Videos, emisoras, podcasts y aplicaciones en una sola búsqueda."
        actions={
          <Button variant="glass" size="sm" onClick={() => openWithPrompt(`Busca ${query || "algo interesante"} en TECLA LIVE.`)}>
            <Sparkles className="size-4" aria-hidden />
            Pedir a TECLA AI
          </Button>
        }
      />

      <div className="mb-6 rounded-3xl border border-border bg-surface/45 p-4 md:p-5">
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Busca en TECLA LIVE…"
              aria-label="Búsqueda universal"
              className="h-13 pl-11"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg">
            Buscar
          </Button>
        </form>
      </div>

      {!query ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-3">Búsquedas recientes</p>
            {searches.length === 0 ? (
              <p className="text-[11px] text-muted">Tus búsquedas aparecerán aquí.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {searches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      addSearch(item);
                      router.push(`/search?q=${encodeURIComponent(item)}`);
                    }}
                    className="min-h-9 rounded-full border border-border px-3 text-[11px] text-muted transition-colors hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-3">Atajos</p>
            <div className="flex flex-wrap gap-2">
              {["tecnología", "vallenato", "podcasts", "noticias", "música"].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setInput(term);
                    addSearch(term);
                    router.push(`/search?q=${encodeURIComponent(term)}`);
                  }}
                  className="min-h-9 rounded-full bg-surface px-3 text-[11px] text-muted transition-colors hover:text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : !hasAnyResults &&
        !youtube.isLoading &&
        !radio.isLoading &&
        !podcasts.isLoading &&
        !youtube.isError &&
        !radio.isError &&
        !podcasts.isError ? (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description="Prueba con un tema más general o pídele a TECLA AI que busque por ti."
          action={
            <Button variant="glass" size="sm" onClick={() => openWithPrompt(`Busca ${query} en YouTube.`)}>
              <Sparkles className="size-3.5" aria-hidden />
              Buscar con TECLA AI
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {apps.length > 0 ? (
            <section aria-label="Aplicaciones">
              <p className="eyebrow mb-2">Aplicaciones</p>
              <div className="flex flex-wrap gap-2">
                {apps.map((app) => (
                  <Link
                    key={app.id}
                    href={app.id === "ai" ? "/ai" : app.href}
                    className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-xs font-medium transition-colors hover:border-accent/30"
                  >
                    <span className={cn("flex size-6 items-center justify-center rounded-lg bg-gradient-to-br text-white", app.gradient)}>
                      <app.icon className="size-3" aria-hidden />
                    </span>
                    {app.name}
                    {app.external ? <ExternalLink className="size-3 text-muted" aria-hidden /> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="Videos de YouTube">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="eyebrow">YouTube</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Videos</h2>
              </div>
              <Link href="/youtube" className="text-[11px] text-muted hover:text-foreground">
                Abrir YouTube
              </Link>
            </div>
            {youtube.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="aspect-video w-full rounded-3xl" />
                ))}
              </div>
            ) : youtube.isError ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-[11px] text-amber-600 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                YouTube no está disponible o no está configurado. Puedes usar la búsqueda de radio y podcasts.
              </div>
            ) : youtube.data?.videos.length ? (
              <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {youtube.data.videos.map((video) => (
                  <MediaCard
                    key={video.id}
                    className="w-full"
                    item={{
                      kind: "youtube",
                      providerId: video.id,
                      title: video.title,
                      subtitle: video.channelTitle,
                      imageUrl: video.thumbnail,
                      href: `/watch/${video.id}`,
                      durationSeconds: video.durationSeconds,
                      live: video.liveBroadcastContent === "live",
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-[11px] text-muted">
                Sin videos para esta búsqueda.
              </p>
            )}
          </section>

          <section aria-label="Radio">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="eyebrow">Radio Browser</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Emisoras</h2>
              </div>
              <Link href="/radio" className="text-[11px] text-muted hover:text-foreground">
                Toda la radio
              </Link>
            </div>
            {radio.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : radio.data?.stations.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {radio.data.stations.map((station) => {
                  const favorite = favorites.some(
                    (item) => item.kind === "radio" && item.providerId === station.id,
                  );
                  return (
                    <div
                      key={station.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-surface/35 p-3"
                    >
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#f6b756]/10 text-[#f6b756]">
                        <Radio className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{station.name}</p>
                        <p className="truncate text-[10px] text-muted">
                          {station.tags?.slice(0, 3).join(" · ") || station.country}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const added = toggleFavorite({
                            kind: "radio",
                            providerId: station.id,
                            title: station.name,
                            subtitle: station.tags?.slice(0, 3).join(" · "),
                            imageUrl: station.favicon,
                            href: `/radio?station=${station.id}`,
                          });
                          toast({ title: added ? "Emisora guardada" : "Emisora quitada", variant: added ? "success" : "info" });
                        }}
                        aria-label="Guardar emisora"
                        className="flex size-9 items-center justify-center rounded-full text-muted"
                      >
                        <Heart className={cn("size-3.5", favorite && "fill-red-400 text-red-400")} />
                      </button>
                      <Link
                        href={`/radio?station=${encodeURIComponent(station.id)}`}
                        className="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent"
                        aria-label={`Abrir ${station.name}`}
                      >
                        <Play className="ml-0.5 size-3.5 fill-current" aria-hidden />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-[11px] text-muted">
                Sin emisoras para esta búsqueda.
              </p>
            )}
          </section>

          <section aria-label="Podcasts">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="eyebrow">iTunes</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Podcasts</h2>
              </div>
              <Link href="/podcasts" className="text-[11px] text-muted hover:text-foreground">
                Abrir podcasts
              </Link>
            </div>
            {podcasts.isLoading ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : podcasts.data?.episodes.length ? (
              <div className="space-y-2">
                {podcasts.data.episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface/35 p-3"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ff9a76]/10 text-[#ff9a76]">
                      <Podcast className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-medium">{episode.title}</p>
                      <p className="line-clamp-1 text-[10px] text-muted">
                        {episode.podcastTitle}
                        {episode.durationSeconds ? ` · ${formatDuration(episode.durationSeconds)}` : ""}
                      </p>
                    </div>
                    {episode.externalUrl ? (
                      <a
                        href={episode.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-[10px] font-medium text-muted hover:text-foreground"
                      >
                        Escuchar
                        <ExternalLink className="size-2.5" aria-hidden />
                      </a>
                    ) : (
                      <Link href="/podcasts" className="flex min-h-9 items-center rounded-full border border-border px-3 text-[10px] text-muted">
                        Abrir
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-4 text-[11px] text-muted">
                Sin podcasts para esta búsqueda.
              </p>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/40 p-4">
            <p className="text-[11px] text-muted">
              ¿No encuentras algo? TECLA AI puede combinar búsquedas y abrir la pantalla correcta.
            </p>
            <Button
              variant="glass"
              size="sm"
              onClick={() => openWithPrompt(`Busca ${query} y recomiéndame un resultado.`)}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Preguntar a TECLA AI
              <ArrowRight className="size-3" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
