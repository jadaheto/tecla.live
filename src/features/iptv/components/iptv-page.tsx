"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import type HlsType from "hls.js";
import {
  FileUp,
  Heart,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Tv,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { useIptv } from "@/stores/iptv";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { registerMediaController } from "@/features/media/player-bridge";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";
import {
  MAX_M3U_BYTES,
  M3uParseError,
  parseM3u,
  type M3uChannel,
} from "@/lib/integrations/m3u";

interface ChannelWithPlaylist extends M3uChannel {
  playlistId: string;
  playlistName: string;
}

export function IptvPage() {
  const playlists = useIptv((state) => state.playlists);
  const addPlaylist = useIptv((state) => state.addPlaylist);
  const removePlaylist = useIptv((state) => state.removePlaylist);
  const favorites = useLibrary((state) => state.favorites);
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);
  const setCurrent = usePlayer((state) => state.setCurrent);
  const setStorePlaying = usePlayer((state) => state.setPlaying);

  const [importName, setImportName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("all");
  const [selected, setSelected] = React.useState<ChannelWithPlaylist | null>(null);
  const [playerError, setPlayerError] = React.useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<HlsType | null>(null);
  const selectedRef = React.useRef<ChannelWithPlaylist | null>(null);
  const playingRef = React.useRef(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  React.useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const channels = React.useMemo<ChannelWithPlaylist[]>(
    () =>
      playlists.flatMap((playlist) =>
        playlist.channels.map((channel) => ({
          ...channel,
          playlistId: playlist.id,
          playlistName: playlist.name,
        })),
      ),
    [playlists],
  );

  const groups = React.useMemo(() => {
    const set = new Set<string>();
    for (const channel of channels) if (channel.group) set.add(channel.group);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es")).slice(0, 80);
  }, [channels]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels.filter((channel) => {
      if (group !== "all" && channel.group !== group) return false;
      if (!needle) return true;
      return (
        channel.name.toLowerCase().includes(needle) ||
        channel.group?.toLowerCase().includes(needle) ||
        channel.playlistName.toLowerCase().includes(needle)
      );
    });
  }, [channels, group, query]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !selected) return;
    let destroyed = false;
    setPlayerError(null);
    setLoadingVideo(true);

    async function load() {
      if (!video || !selected) return;
      try {
        if (selected.isHls) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = selected.url;
          } else {
            const { default: Hls } = await import("hls.js");
            if (destroyed) return;
            if (!Hls.isSupported()) {
              setPlayerError("Este navegador no puede reproducir HLS. Prueba en otro navegador.");
              setLoadingVideo(false);
              return;
            }
            const hls = new Hls({
              maxBufferLength: 20,
              lowLatencyMode: false,
              enableWorker: true,
            });
            hlsRef.current = hls;
            hls.loadSource(selected.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                setPlayerError(
                  "No pudimos reproducir el canal HLS. Puede requerir CORS del proveedor o estar fuera de línea.",
                );
                setLoadingVideo(false);
              }
            });
          }
        } else {
          video.src = selected.url;
        }

        await video.play().catch(() => {
          setPlayerError("El navegador bloqueó la reproducción. Toca el botón de reproducir.");
          setLoadingVideo(false);
        });
      } catch {
        setPlayerError("No pudimos cargar el canal. Revisa que el enlace siga activo.");
        setLoadingVideo(false);
      }
    }

    void load();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [selected]);

  React.useEffect(() => {
    return registerMediaController({
      getSnapshot: () => ({
        active: Boolean(selectedRef.current),
        kind: "iptv",
        title: selectedRef.current?.name ?? null,
        isPlaying: playingRef.current,
        positionSeconds: videoRef.current?.currentTime ?? 0,
        durationSeconds: Number.isFinite(videoRef.current?.duration ?? 0)
          ? videoRef.current?.duration ?? 0
          : 0,
        canControl: Boolean(videoRef.current),
      }),
      play: async () => {
        if (!videoRef.current) return { ok: false, message: "No hay un canal seleccionado." };
        try {
          await videoRef.current.play();
          return { ok: true, message: "Canal reanudado." };
        } catch {
          return { ok: false, message: "El navegador bloqueó la reproducción." };
        }
      },
      pause: async () => {
        videoRef.current?.pause();
        return { ok: true, message: "Canal pausado." };
      },
      next: async () => ({ ok: false, message: "Elige otro canal de la lista." }),
    });
  }, []);

  function importFromText(raw: string, overrideName?: string) {
    setImportError(null);
    setImporting(true);
    try {
      if (raw.length > MAX_M3U_BYTES) {
        throw new M3uParseError("TOO_LARGE", "El archivo supera el máximo de 5 MB.");
      }
      const parsed = parseM3u(raw);
      const name = (overrideName ?? importName).trim() || parsed.name;
      addPlaylist(name, parsed.channels);
      setContent("");
      setImportName("");
      if (fileRef.current) fileRef.current.value = "";
      toast({
        title: "Lista importada",
        description: `${parsed.channels.length} canales en «${name}».`,
        variant: "success",
      });
    } catch (error) {
      setImportError(
        error instanceof M3uParseError ? error.message : "No pudimos interpretar la lista M3U.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_M3U_BYTES) {
      setImportError("El archivo supera el máximo de 5 MB.");
      return;
    }
    try {
      const text = await file.text();
      const fallbackName = file.name.replace(/\.(m3u8?|txt)$/i, "").slice(0, 60);
      setContent(text);
      importFromText(text, importName.trim() || fallbackName);
    } catch {
      setImportError("No pudimos leer el archivo.");
    }
  }

  function playChannel(channel: ChannelWithPlaylist) {
    setSelected(channel);
    setCurrent({
      kind: "iptv",
      id: channel.id,
      title: channel.name,
      subtitle: channel.playlistName,
      imageUrl: channel.logo,
      href: "/iptv",
    });
    setStorePlaying(true);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setPlayerError("El navegador bloqueó la reproducción."));
    } else {
      video.pause();
    }
  }

  function toggleChannelFavorite(channel: ChannelWithPlaylist) {
    const added = toggleFavorite({
      kind: "iptv",
      providerId: channel.id,
      title: channel.name,
      subtitle: channel.playlistName,
      imageUrl: channel.logo,
      href: "/iptv",
    });
    toast({
      title: added ? "Canal guardado" : "Canal quitado",
      description: channel.name,
      variant: added ? "success" : "info",
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Televisión"
        title="Tus canales, en orden."
        description="Importa listas M3U/M3U8 autorizadas y reproduce HLS compatible en el navegador. No distribuimos listas."
        actions={
          <Badge variant="outline">
            <Tv className="size-3" aria-hidden />
            {channels.length} canales
          </Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {selected ? (
            <div className="overflow-hidden rounded-[1.8rem] border border-border bg-black shadow-[var(--shadow-card)]">
              <div className="relative aspect-video w-full bg-black">
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  className="size-full"
                  onPlaying={() => {
                    setPlaying(true);
                    setLoadingVideo(false);
                    setStorePlaying(true);
                  }}
                  onPause={() => {
                    setPlaying(false);
                    setStorePlaying(false);
                  }}
                  onWaiting={() => setLoadingVideo(true)}
                  onError={() =>
                    setPlayerError(
                      "El canal no se pudo reproducir. Puede estar fuera de línea, requerir CORS o usar un códec incompatible.",
                    )
                  }
                />
                <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                  <Badge variant="live">
                    <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                    En vivo
                  </Badge>
                  {selected.insecure ? <Badge variant="warning">HTTP</Badge> : null}
                </div>
                {loadingVideo ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="size-8 animate-spin text-white" aria-hidden />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#0b0b0e] p-4 text-white">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{selected.name}</p>
                  <p className="text-[10px] text-white/45">
                    {selected.playlistName} {selected.group ? `· ${selected.group}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="flex size-10 items-center justify-center rounded-full bg-white text-black"
                  aria-label={playing ? "Pausar canal" : "Reproducir canal"}
                >
                  {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={() => toggleChannelFavorite(selected)}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70"
                  aria-label="Guardar canal en favoritos"
                >
                  <Heart
                    className={cn(
                      "size-4",
                      favorites.some((item) => item.kind === "iptv" && item.providerId === selected.id) &&
                        "fill-red-400 text-red-400",
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white/70"
                  aria-label="Cerrar reproductor"
                >
                  <X className="size-4" />
                </button>
              </div>
              {playerError ? (
                <p className="flex items-start gap-2 border-t border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-300">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {playerError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 rounded-3xl border border-border bg-surface/45 p-4 md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar canal o categoría…"
                  aria-label="Buscar canal IPTV"
                  className="h-12 pl-11"
                />
              </div>
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                aria-label="Filtrar por categoría"
                className="min-h-12 max-w-[220px] rounded-2xl border border-border bg-surface px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <option value="all">Todas las categorías</option>
                {groups.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-[10px] text-muted">
              {channels.length === 0
                ? "Importa una lista para empezar."
                : `${filtered.length} de ${channels.length} canales`}
            </p>
          </div>

          <div className="mt-4">
            {channels.length === 0 ? (
              <EmptyState
                icon={Tv}
                title="Todavía no hay canales"
                description="Importa una lista M3U autorizada desde el panel derecho. Se guarda solo en este navegador."
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Sin canales para ese filtro"
                description="Cambia la categoría o borra la búsqueda."
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setGroup("all");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.slice(0, 300).map((channel) => {
                  const active = selected?.id === channel.id;
                  const favorite = favorites.some(
                    (item) => item.kind === "iptv" && item.providerId === channel.id,
                  );
                  return (
                    <div
                      key={`${channel.playlistId}-${channel.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                        active
                          ? "border-accent/40 bg-accent/[0.05]"
                          : "border-border bg-surface/35",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => playChannel(channel)}
                        className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#b18cff]/25 to-[#120524] text-violet"
                        aria-label={`Reproducir ${channel.name}`}
                      >
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 size-full object-contain p-1"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Tv className="size-4" aria-hidden />
                        )}
                        <span className="relative flex size-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                          <Play className="ml-0.5 size-3 fill-current" aria-hidden />
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-xs font-medium">{channel.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-[9px] text-muted">
                          {channel.group || channel.playlistName}
                          {channel.isHls ? " · HLS" : ""}
                          {channel.insecure ? " · HTTP" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleChannelFavorite(channel)}
                        aria-label="Guardar canal"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
                      >
                        <Heart className={cn("size-3.5", favorite && "fill-red-400 text-red-400")} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {filtered.length > 300 ? (
            <p className="mt-3 text-center text-[10px] text-muted">
              Mostrando 300 canales. Usa la búsqueda o el filtro de categoría para acotar.
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-1">Importar</p>
            <h2 className="text-base font-semibold">Lista M3U / M3U8</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Sube un archivo o pega el contenido de una lista que tengas derecho a usar. TECLA LIVE no
              descarga listas ni hace proxy de URLs arbitrarias.
            </p>

            <div className="mt-4 space-y-2.5">
              <Input
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
                placeholder="Nombre de la lista (opcional)"
                aria-label="Nombre de la lista"
                maxLength={60}
              />

              <input
                ref={fileRef}
                type="file"
                accept=".m3u,.m3u8,text/plain"
                className="sr-only"
                id="iptv-file"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <label
                htmlFor="iptv-file"
                className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-foreground"
              >
                <FileUp className="size-4" aria-hidden />
                Elegir archivo M3U
              </label>

              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="…o pega aquí el contenido #EXTM3U"
                aria-label="Contenido M3U"
                className="min-h-28 font-mono text-[10px]"
              />

              <Button
                className="w-full"
                onClick={() => importFromText(content)}
                loading={importing}
                disabled={!content.trim()}
              >
                Importar lista
              </Button>

              {importError ? (
                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[10px] leading-relaxed text-red-400">
                  {importError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Mis listas</p>
              {playlists.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    useIptv.getState().clearAll();
                    setSelected(null);
                    toast({ title: "Listas eliminadas", variant: "info" });
                  }}
                  className="text-[10px] text-muted hover:text-red-400"
                >
                  Borrar todas
                </button>
              ) : null}
            </div>
            {playlists.length === 0 ? (
              <p className="mt-3 text-[11px] text-muted">Aún no has importado listas.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {playlists.map((playlist) => (
                  <li
                    key={playlist.id}
                    className="flex items-center gap-2 rounded-xl border border-border/70 p-2.5"
                  >
                    <Tv className="size-4 shrink-0 text-violet" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{playlist.name}</p>
                      <p className="text-[9px] text-muted">
                        {playlist.channels.length} canales ·{" "}
                        {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
                          new Date(playlist.importedAt),
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removePlaylist(playlist.id);
                        if (selected?.playlistId === playlist.id) setSelected(null);
                      }}
                      aria-label={`Eliminar lista ${playlist.name}`}
                      className="flex size-8 items-center justify-center rounded-full text-muted hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-amber-500/15 bg-amber-500/5 p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-4" aria-hidden />
              Uso responsable
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Importa solo listas autorizadas. No distribuimos contenido pirata ni eludimos DRM o
              restricciones de proveedores. Algunos canales usan HTTP y el navegador los bloqueará
              en un sitio HTTPS.
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted/60">
              <RefreshCw className="size-3" aria-hidden />
              HLS se reproduce con hls.js cuando el navegador no lo soporta de forma nativa.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
