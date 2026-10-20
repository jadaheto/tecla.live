"use client";

import * as React from "react";
import Link from "next/link";
import {
  Heart,
  ListVideo,
  Play,
  Radio,
  Sparkles,
  TriangleAlert,
  TvMinimalPlay,
  type LucideIcon,
} from "lucide-react";
import { Greeting } from "@/components/dashboard/greeting";
import { Hero } from "@/components/dashboard/hero";
import { WeatherCard } from "@/components/dashboard/weather-card";
import { AiSpotlight } from "@/components/dashboard/ai-spotlight";
import { DashboardAppCard, QuickAccess } from "@/components/dashboard/quick-access";
import { MediaCard, type MediaCardData } from "@/components/media/media-card";
import { MediaRow } from "@/components/media/media-row";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { useYouTubeTrending } from "@/features/youtube/hooks";
import { useRadioStations } from "@/features/radio/hooks";
import { useLibrary } from "@/stores/library";
import { usePreferences } from "@/stores/preferences";
import { useAi } from "@/features/ai/store";
import { APPS } from "@/lib/catalog";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { DashboardSectionId } from "@/lib/catalog";
import type { MediaKind, SavedFavorite, YouTubeVideo } from "@/types";

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
    case "destination":
      return "/navigate";
    default:
      return "/";
  }
}

function videoToCard(video: YouTubeVideo): MediaCardData {
  return {
    kind: "youtube",
    providerId: video.id,
    title: video.title,
    subtitle: video.channelTitle,
    imageUrl: video.thumbnail,
    href: `/watch/${video.id}`,
    durationSeconds: video.durationSeconds,
    live: video.liveBroadcastContent === "live",
  };
}

function favoriteToCard(favorite: SavedFavorite): MediaCardData {
  return {
    kind: favorite.kind,
    providerId: favorite.providerId,
    title: favorite.title,
    subtitle: favorite.subtitle,
    imageUrl: favorite.imageUrl,
    href: favorite.href || defaultHref(favorite.kind, favorite.providerId),
  };
}

function RowNotice({
  icon: Icon,
  title,
  description,
  href,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[132px] w-full min-w-full shrink-0 flex-col gap-4 rounded-3xl border border-dashed border-border bg-surface/35 p-5 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{description}</p>
      </div>
      {onAction && actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className={cn(buttonVariants({ variant: "subtle", size: "sm" }), "shrink-0")}
        >
          {actionLabel}
        </button>
      ) : href && actionLabel ? (
        <Link
          href={href}
          className={cn(buttonVariants({ variant: "subtle", size: "sm" }), "shrink-0")}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function RowSkeletons({ square = false }: { square?: boolean }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className={cn("shrink-0", square ? "w-[168px] sm:w-[186px]" : "w-[248px] sm:w-[286px] xl:w-[316px]")}
          aria-hidden
        >
          <Skeleton className={cn("w-full", square ? "aspect-square" : "aspect-video", "rounded-[1.4rem]")} />
          <Skeleton className="mt-3 h-3.5 w-4/5 rounded-full" />
          <Skeleton className="mt-2 h-3 w-2/5 rounded-full" />
        </div>
      ))}
    </>
  );
}

export function Dashboard() {
  const trending = useYouTubeTrending(14);
  const music = useRadioStations("", 12);
  const favorites = useLibrary((state) => state.favorites);
  const history = useLibrary((state) => state.history);
  const playlists = useLibrary((state) => state.playlists);
  const dashboardOrder = usePreferences((state) => state.dashboardOrder);
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  const videoFavorites = React.useMemo(
    () => favorites.filter((favorite) => favorite.kind === "youtube"),
    [favorites],
  );

  const continueItems = React.useMemo(
    () =>
      history
        .filter((entry) => {
          if (entry.kind !== "youtube" && entry.kind !== "podcast") return false;
          if (entry.durationSeconds <= 0) return entry.positionSeconds > 10;
          return entry.positionSeconds > 10 && entry.positionSeconds < entry.durationSeconds * 0.97;
        })
        .slice(0, 10)
        .map((entry) => ({
          kind: entry.kind,
          providerId: entry.providerId,
          title: entry.title,
          subtitle: entry.subtitle,
          imageUrl: entry.imageUrl,
          href: entry.href || defaultHref(entry.kind, entry.providerId),
          durationSeconds: entry.durationSeconds,
          progressPercent:
            entry.durationSeconds > 0 ? (entry.positionSeconds / entry.durationSeconds) * 100 : undefined,
        })),
    [history],
  );

  const recommendedCards = React.useMemo(() => {
    if (videoFavorites.length > 0) return videoFavorites.slice(0, 10).map(favoriteToCard);
    return (trending.data?.videos ?? []).slice(2, 10).map(videoToCard);
  }, [trending.data, videoFavorites]);

  const trendingVideos = trending.data?.videos ?? [];
  const youtubeError = trending.error;
  const notConfigured = youtubeError instanceof ApiError && youtubeError.status === 503;

  const rows: Record<DashboardSectionId, React.ReactNode> = {
    continue: (
      <MediaRow
        title="Continuar viendo"
        subtitle="Retoma justo donde lo dejaste."
        actionHref={continueItems.length > 0 ? "/favorites" : undefined}
        actionLabel="Mi biblioteca"
      >
        {continueItems.length > 0 ? (
          continueItems.map((item) => (
            <MediaCard key={`${item.kind}-${item.providerId}`} item={item} />
          ))
        ) : (
          <RowNotice
            icon={Play}
            title="Todavía no hay nada en curso"
            description="Cuando reproduzcas un video o un podcast, guardaremos tu avance en este dispositivo para retomarlo después."
            href="/youtube"
            actionLabel="Explorar videos"
          />
        )}
      </MediaRow>
    ),

    trending: (
      <MediaRow
        title="Tendencias en Colombia"
        eyebrow="YouTube"
        subtitle="Lo que más se está viendo ahora."
        actionHref="/youtube"
        actionLabel="Ver todo"
      >
        {trending.isLoading ? (
          <RowSkeletons />
        ) : notConfigured ? (
          <RowNotice
            icon={TriangleAlert}
            title="YouTube aún no está configurado"
            description="Añade YOUTUBE_API_KEY en el servidor para cargar videos y tendencias reales. El resto del centro de entretenimiento funciona con normalidad."
            href="/settings"
            actionLabel="Ver configuración"
          />
        ) : trendingVideos.length > 0 ? (
          trendingVideos.map((video) => <MediaCard key={video.id} item={videoToCard(video)} />)
        ) : (
          <RowNotice
            icon={TvMinimalPlay}
            title="No hay tendencias disponibles"
            description="YouTube no devolvió resultados en este momento. Intenta de nuevo más tarde o busca un video directamente."
            href="/youtube"
            actionLabel="Buscar en YouTube"
          />
        )}
      </MediaRow>
    ),

    recommended: (
      <MediaRow
        title="Recomendados para ti"
        subtitle={
          videoFavorites.length > 0
            ? "A partir de tus favoritos y de las tendencias de hoy."
            : "Una selección editorial de las tendencias de hoy."
        }
        actionHref="/youtube"
      >
        {trending.isLoading && recommendedCards.length === 0 ? (
          <RowSkeletons />
        ) : recommendedCards.length > 0 ? (
          recommendedCards.map((item) => (
            <MediaCard key={`${item.kind}-${item.providerId}`} item={item} />
          ))
        ) : (
          <RowNotice
            icon={Sparkles}
            title="Construyamos tu selección"
            description="Guarda videos como favoritos y TECLA AI podrá recomendarte mejor. También puedes pedirle una sugerencia directamente."
            onAction={() => openWithPrompt("Recomiéndame algo para ver hoy.")}
            actionLabel="Pedir recomendación"
          />
        )}
      </MediaRow>
    ),

    favorites: (
      <MediaRow
        title="Favoritos"
        subtitle="Lo que guardaste en este dispositivo."
        actionHref="/favorites"
        actionLabel="Abrir biblioteca"
      >
        {favorites.length > 0 ? (
          favorites
            .slice(0, 12)
            .map((favorite) => <MediaCard key={`${favorite.kind}-${favorite.providerId}`} item={favoriteToCard(favorite)} />)
        ) : (
          <RowNotice
            icon={Heart}
            title="Tus favoritos empiezan aquí"
            description="Toca el corazón en cualquier video, emisora o podcast. Se guardan sin cuenta en este navegador."
            href="/youtube"
            actionLabel="Descubrir contenido"
          />
        )}
      </MediaRow>
    ),

    music: (
      <MediaRow
        title="Música y radio"
        eyebrow="En vivo"
        subtitle="Emisoras colombianas disponibles ahora."
        actionHref="/radio"
        actionLabel="Toda la radio"
      >
        {music.isLoading ? (
          <RowSkeletons square />
        ) : music.data?.stations.length ? (
          music.data.stations.slice(0, 12).map((station) => (
            <MediaCard
              key={station.id}
              aspect="square"
              compact
              item={{
                kind: "radio",
                providerId: station.id,
                title: station.name,
                subtitle: station.tags?.slice(0, 2).join(" · ") || station.country || "Radio en vivo",
                imageUrl: station.favicon,
                href: `/radio?station=${encodeURIComponent(station.id)}`,
                live: true,
              }}
            />
          ))
        ) : (
          <RowNotice
            icon={Radio}
            title="La radio no respondió"
            description="El directorio de emisoras no está disponible en este momento. Puedes intentarlo de nuevo desde la sección Radio."
            href="/radio"
            actionLabel="Ir a Radio"
          />
        )}
      </MediaRow>
    ),

    lists: (
      <MediaRow title="Mis listas" subtitle="Colecciones propias de TECLA LIVE." actionHref="/favorites">
        {playlists.length > 0 ? (
          playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href="/favorites"
              className="group flex w-[228px] shrink-0 snap-start flex-col justify-between rounded-3xl border border-border bg-gradient-to-br from-violet/15 via-surface to-surface p-5 transition-colors hover:border-violet/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-violet/15 text-violet">
                <ListVideo className="size-5" aria-hidden />
              </span>
              <span className="mt-8">
                <span className="line-clamp-1 text-sm font-semibold">{playlist.name}</span>
                <span className="mt-1 block text-[11px] text-muted">
                  {playlist.items.length} {playlist.items.length === 1 ? "elemento" : "elementos"}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <RowNotice
            icon={ListVideo}
            title="Crea tu primera lista"
            description="Organiza videos y emisoras en colecciones propias. No son listas de YouTube: viven en tu biblioteca de TECLA LIVE."
            href="/favorites"
            actionLabel="Crear una lista"
          />
        )}
      </MediaRow>
    ),

    apps: (
      <MediaRow
        title="Aplicaciones"
        subtitle="Todo tu ecosistema, a un toque."
        actionHref="/apps"
        actionLabel="Ver todas"
      >
        {APPS.map((app) => (
          <DashboardAppCard key={app.id} app={app} />
        ))}
      </MediaRow>
    ),
  };

  return (
    <div>
      <Greeting />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Hero />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <WeatherCard />
          <AiSpotlight />
        </div>
      </div>

      <QuickAccess />

      <div className="mt-8 space-y-9 md:mt-10 md:space-y-11">
        {dashboardOrder.map((sectionId) => (
          <React.Fragment key={sectionId}>{rows[sectionId]}</React.Fragment>
        ))}
      </div>
    </div>
  );
}
