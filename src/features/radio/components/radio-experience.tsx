"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Headphones,
  Heart,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRadioStation, useRadioStations } from "@/features/radio/hooks";
import { useLibrary } from "@/stores/library";
import { usePreferences } from "@/stores/preferences";
import { useAi } from "@/features/ai/store";
import { pauseRadio, playRadioStation, resumeRadio, useRadioAudio } from "@/features/radio/radio-audio";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";
import type { RadioStation } from "@/types";

function stationImage(station: RadioStation): string | null {
  return station.favicon?.startsWith("https://") ? station.favicon : null;
}

export function RadioExperience() {
  const searchParams = useSearchParams();
  const initialStationId = searchParams.get("station");
  // `autoplay=1` lo añade TECLA AI al poner una emisora por voz: arranca sin tocar la pantalla.
  const autoplayRequested = searchParams.get("autoplay") === "1";
  const autoplayDoneRef = React.useRef(false);
  const [input, setInput] = React.useState("");
  const [activeQuery, setActiveQuery] = React.useState("");
  const stationsQuery = useRadioStations(activeQuery, 30);
  // El audio vive en el reproductor global (sigue sonando al cambiar de pantalla).
  const radio = useRadioAudio();
  const [picked, setPicked] = React.useState<RadioStation | null>(null);
  const selected = picked ?? radio.station;
  const playing = radio.playing;
  const loadingAudio = radio.loading;
  const audioError = radio.error;
  const stationLookup = useRadioStation(selected ? null : initialStationId);

  const favorites = useLibrary((state) => state.favorites);
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);
  const addSearch = useLibrary((state) => state.addSearch);
  const volume = usePreferences((state) => state.volume);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  const isStationFavorite = (station: RadioStation) =>
    favorites.some((favorite) => favorite.kind === "radio" && favorite.providerId === station.id);

  React.useEffect(() => {
    if (selected) return;
    const fromParam = initialStationId
      ? stationsQuery.data?.stations.find((station) => station.id === initialStationId)
      : undefined;
    const station = fromParam ?? stationLookup.data?.station ?? null;
    if (!station) return;
    if (autoplayRequested && !autoplayDoneRef.current) {
      autoplayDoneRef.current = true;
      playStation(station);
      return;
    }
    setPicked(station);
    // playStation es estable (usa el reproductor global); no se incluye para no reiniciar la emisora.
  }, [initialStationId, selected, stationLookup.data, stationsQuery.data, autoplayRequested]);

  function playStation(station: RadioStation) {
    setPicked(station);
    void playRadioStation(station);
    try {
      window.history.replaceState(null, "", `/radio?station=${encodeURIComponent(station.id)}`);
    } catch {
      // El historial puede no estar disponible.
    }
  }

  function togglePlayback() {
    if (!selected) return;
    if (playing) {
      pauseRadio();
      return;
    }
    if (radio.station?.id === selected.id) {
      void resumeRadio();
      return;
    }
    playStation(selected);
  }

  function toggleStationFavorite(station: RadioStation) {
    const added = toggleFavorite({
      kind: "radio",
      providerId: station.id,
      title: station.name,
      subtitle: station.tags?.slice(0, 3).join(" · "),
      imageUrl: station.favicon,
      href: `/radio?station=${station.id}`,
    });
    toast({
      title: added ? "Emisora guardada" : "Emisora quitada",
      description: station.name,
      variant: added ? "success" : "info",
    });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = input.trim();
    setActiveQuery(query);
    if (query) addSearch(query);
  }

  const stations = stationsQuery.data?.stations ?? [];
  const selectedFavorite = selected ? isStationFavorite(selected) : false;

  return (
    <div>
      <PageHeader
        eyebrow="En vivo"
        title="Radio para el camino."
        description="Emisoras colombianas reales del directorio Radio Browser. Audio HTML5 y favoritos sin cuenta."
        actions={
          <>
            <Button variant="glass" size="sm" onClick={() => openWithPrompt("Busca una emisora de vallenato.")}>
              <Sparkles className="size-4" aria-hidden />
              Pedir a TECLA AI
            </Button>
            <Link
              href="/podcasts"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              <Headphones className="size-3.5" aria-hidden />
              Podcasts
            </Link>
          </>
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
                  placeholder="Busca vallenato, noticias, salsa, emisoras…"
                  aria-label="Buscar emisoras de radio"
                  className="h-12 pl-11"
                />
              </div>
              <Button type="submit" size="lg">
                Buscar
              </Button>
              {activeQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setActiveQuery("");
                    setInput("");
                  }}
                >
                  Limpiar
                </Button>
              ) : null}
            </form>
            <p className="mt-2 px-1 text-[10px] text-muted">
              Solo se muestran emisoras HTTPS compatibles. La disponibilidad depende del directorio y de cada emisora.
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="eyebrow">{activeQuery ? "Resultados" : "Colombia"}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {activeQuery ? `“${activeQuery}”` : "Populares ahora"}
              </h2>
            </div>
            {!stationsQuery.isLoading ? (
              <span className="text-[11px] text-muted">{stations.length} emisoras</span>
            ) : null}
          </div>

          {stationsQuery.isLoading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-[132px] rounded-3xl" />
              ))}
            </div>
          ) : stationsQuery.isError ? (
            <div className="mt-4">
              <EmptyState
                icon={TriangleAlert}
                title="No pudimos cargar las emisoras"
                description="El directorio Radio Browser no respondió. Intenta de nuevo en un momento."
                action={
                  <Button variant="glass" size="sm" onClick={() => void stationsQuery.refetch()}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Reintentar
                  </Button>
                }
              />
            </div>
          ) : stations.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Radio}
                title="Sin emisoras para esa búsqueda"
                description="Prueba con un género, una ciudad o el nombre de la emisora."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {stations.map((station) => {
                const active = selected?.id === station.id;
                const favorite = isStationFavorite(station);
                const image = stationImage(station);
                return (
                  <div
                    key={station.id}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl border bg-surface/45 p-4 transition-colors",
                      active ? "border-accent/40 bg-accent/[0.06]" : "border-border hover:border-border/80",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#f6b756]/30 via-[#7c4a13]/25 to-[#241203] text-[#f6b756]",
                          active && "from-accent/40 text-accent",
                        )}
                      >
                        <Radio className="absolute size-6" aria-hidden />
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 size-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{station.name}</p>
                        <p className="mt-1 line-clamp-1 text-[10px] text-muted">
                          {station.tags?.slice(0, 3).join(" · ") || station.country || "Radio en vivo"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="live">
                            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                            En vivo
                          </Badge>
                          {station.bitrate ? (
                            <span className="font-mono text-[9px] text-muted">{station.bitrate} kbps</span>
                          ) : null}
                          {station.isHls ? <Badge variant="warning">HLS</Badge> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleStationFavorite(station)}
                        aria-label={favorite ? `Quitar ${station.name} de favoritos` : `Guardar ${station.name}`}
                        aria-pressed={favorite}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
                      >
                        <Heart className={cn("size-4", favorite && "fill-red-400 text-red-400")} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => (active && playing ? togglePlayback() : playStation(station))}
                        className={cn(
                          "flex min-h-10 items-center gap-2 rounded-full px-3.5 text-[11px] font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "border border-border text-foreground hover:bg-surface",
                        )}
                      >
                        {active && loadingAudio ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : active && playing ? (
                          <Pause className="size-3.5 fill-current" aria-hidden />
                        ) : (
                          <Play className="size-3.5 fill-current" aria-hidden />
                        )}
                        {active && playing ? "Pausar" : active ? "Reproducir" : "Sintonizar"}
                      </button>
                      {active ? (
                        <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.12em] text-accent">
                          <Volume2 className="size-3" aria-hidden />
                          {playing ? "Sonando" : "Seleccionada"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="relative overflow-hidden rounded-[1.8rem] border border-border bg-[#0a090d] p-5 text-white shadow-[var(--shadow-card)]">
            <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_15%_0%,rgba(246,183,86,0.25),transparent_60%),radial-gradient(80%_70%_at_95%_25%,rgba(255,90,60,0.2),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="eyebrow !text-white/60">Ahora suena</p>
                <Badge variant="live">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                  En vivo
                </Badge>
              </div>

              {selected ? (
                <>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                      <Radio className="absolute size-7 text-[#f6b756]" aria-hidden />
                      {stationImage(selected) ? (
                        <img
                          src={stationImage(selected) ?? ""}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 size-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-base font-semibold leading-snug">{selected.name}</p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-white/55">
                        {selected.tags?.slice(0, 3).join(" · ") || "Radio en vivo"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={togglePlayback}
                      className="flex-1"
                      aria-label={playing ? "Pausar emisora" : "Reproducir emisora"}
                    >
                      {loadingAudio ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : playing ? (
                        <Pause className="size-4 fill-current" aria-hidden />
                      ) : (
                        <Play className="size-4 fill-current" aria-hidden />
                      )}
                      {playing ? "Pausar" : "Reproducir"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleStationFavorite(selected)}
                      aria-label={selectedFavorite ? "Quitar de favoritos" : "Guardar emisora"}
                      className="flex size-13 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10"
                    >
                      <Heart className={cn("size-5", selectedFavorite && "fill-red-400 text-red-400")} />
                    </button>
                  </div>

                  <div className="mt-5 flex items-center gap-2.5">
                    <Volume2 className="size-4 text-white/60" aria-hidden />
                    <Slider
                      aria-label="Volumen de radio"
                      value={[volume]}
                      onValueChange={(value) => setPreferences({ volume: value[0] ?? volume })}
                      min={0}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-8 text-right font-mono text-[10px] text-white/60">{volume}%</span>
                  </div>

                  {selected.isHls ? (
                    <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] leading-relaxed text-amber-200/80">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Esta emisora usa HLS. Si el navegador no lo reproduce, ábrela en Safari o usa otra emisora.
                    </p>
                  ) : null}

                  {audioError ? (
                    <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-[10px] leading-relaxed text-red-200/80">
                      {audioError}
                    </p>
                  ) : null}

                  <p className="mt-4 text-[9px] text-white/35">
                    Audio directo del proveedor · TECLA LIVE no aloja la emisora.
                  </p>
                </>
              ) : (
                <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-white/5 text-[#f6b756]">
                    <Radio className="size-7" aria-hidden />
                  </span>
                  <p className="mt-4 text-sm font-medium">Elige una emisora</p>
                  <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-white/45">
                    Toca «Sintonizar» para escuchar en vivo. También puedes pedirle una emisora a TECLA AI.
                  </p>
                  {stationLookup.isError ? (
                    <p className="mt-3 text-[10px] text-amber-200/70">
                      La emisora solicitada no está disponible.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-2">Compatibilidad</p>
            <p className="text-[11px] leading-relaxed text-muted">
              La radio usa el elemento de audio del navegador. Algunas emisoras HTTP o con CORS
              restrictivo no se pueden reproducir en un sitio HTTPS. En ese caso el enlace directo
              sigue disponible en el proveedor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
