"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock3,
  ExternalLink,
  Heart,
  ListVideo,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MediaCard } from "@/components/media/media-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLibrary } from "@/stores/library";
import { toast } from "@/stores/toast";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import {
  buildGoogleMapsSearchUrl,
  buildWazeSearchUrl,
} from "@/lib/integrations/navigation";
import type { MediaKind, SavedFavorite } from "@/types";

function defaultHref(kind: MediaKind, providerId: string): string {
  switch (kind) {
    case "youtube":
      return `/watch/${providerId}`;
    case "radio":
      return "/radio";
    case "podcast":
      return "/podcasts";
    case "iptv":
      return "/iptv";
    case "channel":
      return "/youtube";
    default:
      return "/";
  }
}

function favoriteToItem(favorite: SavedFavorite) {
  return {
    kind: favorite.kind,
    providerId: favorite.providerId,
    title: favorite.title,
    subtitle: favorite.subtitle,
    imageUrl: favorite.imageUrl,
    href: favorite.href || defaultHref(favorite.kind, favorite.providerId),
  };
}

export function LibraryPage() {
  const favorites = useLibrary((state) => state.favorites);
  const history = useLibrary((state) => state.history);
  const playlists = useLibrary((state) => state.playlists);
  const destinations = useLibrary((state) => state.destinations);
  const clearHistory = useLibrary((state) => state.clearHistory);
  const createPlaylist = useLibrary((state) => state.createPlaylist);
  const deletePlaylist = useLibrary((state) => state.deletePlaylist);
  const removeFromPlaylist = useLibrary((state) => state.removeFromPlaylist);
  const addToPlaylist = useLibrary((state) => state.addToPlaylist);
  const removeDestination = useLibrary((state) => state.removeDestination);

  const [listDialogOpen, setListDialogOpen] = React.useState(false);
  const [listName, setListName] = React.useState("");
  const [expandedPlaylist, setExpandedPlaylist] = React.useState<string | null>(null);

  function handleCreateList(event: React.FormEvent) {
    event.preventDefault();
    const name = listName.trim();
    if (name.length < 2) return;
    createPlaylist(name);
    setListName("");
    setListDialogOpen(false);
    toast({ title: "Lista creada", description: name, variant: "success" });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tu biblioteca"
        title="Favoritos y listas."
        description="Todo lo que guardaste vive en este navegador. Sin cuenta, sin panel administrativo."
        actions={
          <>
            <Button variant="glass" size="sm" onClick={() => setListDialogOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Nueva lista
            </Button>
            <Link
              href="/youtube"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Explorar contenido
            </Link>
          </>
        }
      />

      <Tabs defaultValue="favorites">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="favorites">
            <Heart className="mr-1.5 size-3.5" aria-hidden />
            Favoritos
            <span className="ml-1.5 text-[10px] text-muted">{favorites.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock3 className="mr-1.5 size-3.5" aria-hidden />
            Historial
            <span className="ml-1.5 text-[10px] text-muted">{history.length}</span>
          </TabsTrigger>
          <TabsTrigger value="lists">
            <ListVideo className="mr-1.5 size-3.5" aria-hidden />
            Listas
            <span className="ml-1.5 text-[10px] text-muted">{playlists.length}</span>
          </TabsTrigger>
          <TabsTrigger value="places">
            <MapPin className="mr-1.5 size-3.5" aria-hidden />
            Destinos
            <span className="ml-1.5 text-[10px] text-muted">{destinations.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Aún no tienes favoritos"
              description="Toca el corazón en videos, emisoras o podcasts. También puedes pedirle a TECLA AI que guarde algo concreto."
              action={
                <Link
                  href="/youtube"
                  className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground"
                >
                  Descubrir videos
                </Link>
              }
            />
          ) : (
            <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {favorites.map((favorite) => (
                <MediaCard
                  key={`${favorite.kind}-${favorite.providerId}`}
                  item={favoriteToItem(favorite)}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {history.length > 0
                ? "Tu avance se guarda en este dispositivo."
                : "Aún no hay reproducciones."}
            </p>
            {history.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearHistory();
                  toast({ title: "Historial borrado", variant: "success" });
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Borrar historial
              </Button>
            ) : null}
          </div>

          {history.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="Tu historial está vacío"
              description="Cuando reproduzcas un video o podcast, guardaremos tu avance para que puedas continuar después."
            />
          ) : (
            <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {history.map((entry) => (
                <div key={`${entry.kind}-${entry.providerId}`} className="relative">
                  <MediaCard
                    className="w-full"
                    item={{
                      kind: entry.kind,
                      providerId: entry.providerId,
                      title: entry.title,
                      subtitle: entry.subtitle
                        ? `${entry.subtitle} · ${formatRelativeTime(entry.lastWatchedAt)}`
                        : formatRelativeTime(entry.lastWatchedAt),
                      imageUrl: entry.imageUrl,
                      href: entry.href || defaultHref(entry.kind, entry.providerId),
                      durationSeconds: entry.durationSeconds,
                      progressPercent:
                        entry.durationSeconds > 0
                          ? (entry.positionSeconds / entry.durationSeconds) * 100
                          : 0,
                    }}
                  />
                  <p className="mt-1 px-0.5 text-[10px] text-muted">
                    Continuar en {formatDuration(entry.positionSeconds)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists">
          {playlists.length === 0 ? (
            <EmptyState
              icon={ListVideo}
              title="Crea tu primera lista"
              description="Organiza videos y emisoras en colecciones propias de TECLA LIVE. No son listas oficiales de YouTube."
              action={
                <Button size="sm" onClick={() => setListDialogOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  Nueva lista
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {playlists.map((playlist) => {
                const expanded = expandedPlaylist === playlist.id;
                return (
                  <div
                    key={playlist.id}
                    className="overflow-hidden rounded-3xl border border-border bg-surface/45"
                  >
                    <div className="flex flex-wrap items-center gap-3 p-4 md:p-5">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-violet/15 text-violet">
                        <ListVideo className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{playlist.name}</p>
                        <p className="text-[11px] text-muted">
                          {playlist.items.length} {playlist.items.length === 1 ? "elemento" : "elementos"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPlaylist(expanded ? null : playlist.id)}
                      >
                        {expanded ? "Ocultar" : "Abrir"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          deletePlaylist(playlist.id);
                          toast({ title: "Lista eliminada", description: playlist.name, variant: "info" });
                        }}
                        aria-label={`Eliminar lista ${playlist.name}`}
                        className="text-muted hover:text-red-400"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {expanded ? (
                      <div className="border-t border-border p-4 md:p-5">
                        {playlist.items.length === 0 ? (
                          <p className="text-xs leading-relaxed text-muted">
                            Esta lista está vacía. Abre un video y usa «Añadir a lista» para agregarlo.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {playlist.items.map((item) => (
                              <li
                                key={`${item.kind}-${item.providerId}`}
                                className="flex items-center gap-3 rounded-2xl border border-border/60 p-3"
                              >
                                <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-muted">
                                  {item.kind === "radio" ? (
                                    <Radio className="size-4" aria-hidden />
                                  ) : (
                                    <ListVideo className="size-4" aria-hidden />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium">{item.title}</p>
                                  <p className="truncate text-[10px] text-muted">{item.subtitle}</p>
                                </div>
                                <Link
                                  href={item.href || defaultHref(item.kind, item.providerId)}
                                  className="rounded-full border border-border px-3 py-1.5 text-[10px] font-medium text-muted hover:text-foreground"
                                >
                                  Abrir
                                </Link>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeFromPlaylist(playlist.id, item.kind, item.providerId)
                                  }
                                  aria-label={`Quitar ${item.title} de la lista`}
                                  className="flex size-9 items-center justify-center rounded-full text-muted hover:text-red-400"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {favorites.length > 0 ? (
                          <div className="mt-4 border-t border-border pt-3">
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                              Añadir desde favoritos
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {favorites.slice(0, 8).map((favorite) => {
                                const already = playlist.items.some(
                                  (item) =>
                                    item.kind === favorite.kind &&
                                    item.providerId === favorite.providerId,
                                );
                                return (
                                  <button
                                    key={`${favorite.kind}-${favorite.providerId}`}
                                    type="button"
                                    disabled={already}
                                    onClick={() =>
                                      addToPlaylist(playlist.id, {
                                        kind: favorite.kind,
                                        providerId: favorite.providerId,
                                        title: favorite.title,
                                        subtitle: favorite.subtitle,
                                        imageUrl: favorite.imageUrl,
                                        href: favorite.href,
                                      })
                                    }
                                    className="max-w-[220px] truncate rounded-full border border-border px-3 py-1.5 text-[10px] text-muted transition-colors hover:text-foreground disabled:opacity-40"
                                  >
                                    {favorite.title}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="places">
          {destinations.length === 0 ? (
            <EmptyState
              icon={Navigation}
              title="Sin destinos guardados"
              description="Busca un lugar en Navegación y guárdalo como favorito para abrirlo rápido en Waze o Google Maps."
              action={
                <Link
                  href="/navigate"
                  className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground"
                >
                  Abrir Navegación
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {destinations.map((destination) => (
                <div
                  key={destination.id}
                  className="rounded-3xl border border-border bg-surface/45 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-aqua/10 text-aqua">
                        <MapPin className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{destination.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                          {destination.address}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {destination.kind === "home"
                            ? "Casa"
                            : destination.kind === "work"
                              ? "Trabajo"
                              : "Favorito"}
                        </Badge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDestination(destination.id)}
                      aria-label={`Eliminar ${destination.label}`}
                      className="flex size-9 items-center justify-center rounded-full text-muted hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={buildWazeSearchUrl(destination.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full bg-[#37d6ff]/10 px-3 text-[10px] font-medium text-[#37d6ff]"
                    >
                      Waze
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <a
                      href={buildGoogleMapsSearchUrl(destination.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-[10px] font-medium text-emerald-500"
                    >
                      Google Maps
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva lista</DialogTitle>
            <DialogDescription>
              Una colección propia de TECLA LIVE. No se sincroniza con YouTube ni con Spotify.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateList} className="space-y-4">
            <Input
              value={listName}
              onChange={(event) => setListName(event.target.value)}
              placeholder="Nombre de la lista"
              aria-label="Nombre de la lista"
              maxLength={60}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setListDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={listName.trim().length < 2}>
                Crear lista
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
