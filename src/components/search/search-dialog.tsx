"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Command, Loader2, Search, Sparkles, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUi } from "@/stores/ui";
import { useLibrary } from "@/stores/library";
import { useYouTubeSearch } from "@/features/youtube/hooks";
import { APPS } from "@/lib/catalog";
import { ApiError } from "@/lib/http";
import { cn, formatDuration, truncate } from "@/lib/utils";

export function SearchDialog() {
  const router = useRouter();
  const open = useUi((state) => state.searchOpen);
  const setOpen = useUi((state) => state.setSearchOpen);
  const setAiOpen = useUi((state) => state.setAiOpen);
  const [query, setQuery] = React.useState("");
  const searches = useLibrary((state) => state.searches);
  const addSearch = useLibrary((state) => state.addSearch);
  const clearSearches = useLibrary((state) => state.clearSearches);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const search = useYouTubeSearch(trimmed, 8, open);
  const apps = React.useMemo(() => {
    if (trimmed.length < 1) return APPS.slice(0, 6);
    const needle = trimmed.toLowerCase();
    return APPS.filter(
      (app) =>
        app.name.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle),
    ).slice(0, 6);
  }, [trimmed]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submitSearch() {
    if (!trimmed) return;
    addSearch(trimmed);
    go(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function openApp(id: string, href: string, external?: boolean) {
    if (id === "ai") {
      setOpen(false);
      setAiOpen(true);
      return;
    }
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer");
      setOpen(false);
      return;
    }
    go(href);
  }

  function openVideo(videoId: string) {
    addSearch(trimmed);
    go(`/watch/${videoId}`);
  }

  const notConfigured = search.error instanceof ApiError && search.error.status === 503;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent size="lg" className="p-0" hideClose>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 md:px-6">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitSearch();
              }
            }}
            autoFocus
            placeholder="Busca videos, apps, emisoras…"
            aria-label="Búsqueda universal"
            className="h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:text-foreground"
            aria-label="Cerrar búsqueda"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[62dvh] overflow-y-auto px-3 pb-4 pt-3 md:px-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Búsqueda universal</DialogTitle>
            <DialogDescription>
              Busca videos de YouTube, aplicaciones y contenido guardado.
            </DialogDescription>
          </DialogHeader>

          {trimmed.length === 0 ? (
            <div className="space-y-5 p-2">
              {searches.length > 0 ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="eyebrow">Búsquedas recientes</p>
                    <button
                      type="button"
                      onClick={clearSearches}
                      className="text-[11px] text-muted hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searches.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuery(item)}
                        className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
                      >
                        <Clock3 className="size-3.5" aria-hidden />
                        {item}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <p className="eyebrow mb-2">Accesos rápidos</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {apps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => openApp(app.id, app.href, app.external)}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-transparent px-3 text-left transition-colors hover:border-border hover:bg-surface"
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                          app.gradient,
                        )}
                      >
                        <app.icon className={app.wide ? "h-auto w-6" : "size-4"} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{app.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {app.description}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted/60" aria-hidden />
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-dashed border-border px-4 py-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <Command className="size-3.5" aria-hidden /> K abre la búsqueda
                </span>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1.5">
                  <Command className="size-3.5" aria-hidden /> J abre TECLA AI
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-1">
              {apps.length > 0 ? (
                <section>
                  <p className="eyebrow mb-2">Aplicaciones</p>
                  <div className="space-y-1">
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => openApp(app.id, app.href, app.external)}
                        className="flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-surface"
                      >
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                            app.gradient,
                          )}
                        >
                          <app.icon className={app.wide ? "h-auto w-6" : "size-4"} aria-hidden />
                        </span>
                        <span className="flex-1 text-sm font-medium">{app.name}</span>
                        {app.id === "ai" ? (
                          <Sparkles className="size-4 text-accent" aria-hidden />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="eyebrow">Videos en YouTube</p>
                  {search.isFetching ? (
                    <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Buscando" />
                  ) : null}
                </div>

                {notConfigured ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <p className="font-medium">YouTube no está configurado</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        Puedes buscar aplicaciones y usar el resto de TECLA LIVE. Añade
                        YOUTUBE_API_KEY para activar los videos.
                      </p>
                    </div>
                  </div>
                ) : search.isError ? (
                  <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                    No pudimos buscar videos. Intenta de nuevo en un momento.
                  </p>
                ) : search.data?.videos.length ? (
                  <div className="space-y-1">
                    {search.data.videos.map((video) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => openVideo(video.id)}
                        className="flex min-h-16 w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-surface"
                      >
                        <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-surface">
                          {video.thumbnail ? (
                            <Image
                              src={video.thumbnail}
                              alt=""
                              fill
                              sizes="96px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium leading-snug">
                            {truncate(video.title, 110)}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted">
                            {video.channelTitle}
                            {video.durationSeconds
                              ? ` · ${formatDuration(video.durationSeconds)}`
                              : ""}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : search.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-2xl p-2"
                        aria-hidden
                      >
                        <div className="aspect-video w-24 shrink-0 animate-pulse rounded-xl bg-surface" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface" />
                          <div className="h-3 w-2/5 animate-pulse rounded bg-surface" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
                    Sin videos para “{truncate(trimmed, 50)}”. Prueba otra búsqueda.
                  </p>
                )}
              </section>

              <button
                type="button"
                onClick={submitSearch}
                className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-accent px-4 text-sm font-medium text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Search className="size-4" aria-hidden /> Ver todos los resultados para “
                  {truncate(trimmed, 32)}”
                </span>
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
