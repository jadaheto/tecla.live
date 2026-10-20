"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Play, Sparkles, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useYouTubeTrending } from "@/features/youtube/hooks";
import { useLibrary } from "@/stores/library";
import { useAi } from "@/features/ai/store";
import { toast } from "@/stores/toast";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import type { YouTubeVideo } from "@/types";

export function Hero() {
  const trending = useYouTubeTrending(14);
  const video = trending.data?.videos[0] ?? null;
  const [failedVideoId, setFailedVideoId] = React.useState<string | null>(null);
  const addFavorite = useLibrary((state) => state.addFavorite);
  const removeFavorite = useLibrary((state) => state.removeFavorite);
  const isFavorite = useLibrary((state) =>
    state.favorites.some(
      (favorite) => favorite.kind === "youtube" && favorite.providerId === video?.id,
    ),
  );
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  if (trending.isLoading) {
    return <Skeleton className="min-h-[460px] w-full rounded-[2rem] md:min-h-[520px]" />;
  }

  if (video && failedVideoId !== video.id) {
    return (
      <FeaturedHero
        video={video}
        isFavorite={isFavorite}
        onToggleFavorite={() => {
          if (!video) return;
          if (isFavorite) {
            removeFavorite("youtube", video.id);
            toast({ title: "Quitado de favoritos", variant: "info" });
          } else {
            addFavorite({
              kind: "youtube",
              providerId: video.id,
              title: video.title,
              subtitle: video.channelTitle,
              imageUrl: video.thumbnail,
              href: `/watch/${video.id}`,
            });
            toast({ title: "Añadido a favoritos", description: video.title, variant: "success" });
          }
        }}
        onAskAi={() =>
          openWithPrompt(
            `Usando solo los metadatos disponibles, explícame de qué trata el video «${video.title}» del canal ${video.channelTitle ?? "desconocido"}.`,
          )
        }
        onImageError={() => setFailedVideoId(video.id)}
      />
    );
  }

  const notConfigured =
    trending.error instanceof ApiError && trending.error.status === 503;

  return (
    <EditorialHero
      configured={Boolean(trending.data?.configured)}
      error={
        trending.isError && !notConfigured
          ? "No pudimos cargar las tendencias de YouTube en este momento."
          : undefined
      }
    />
  );
}

function FeaturedHero({
  video,
  isFavorite,
  onToggleFavorite,
  onAskAi,
  onImageError,
}: {
  video: YouTubeVideo;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAskAi: () => void;
  onImageError: () => void;
}) {
  return (
    <section
      aria-label="Contenido destacado"
      className="relative isolate min-h-[460px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a090d] shadow-[var(--shadow-float)] md:min-h-[520px]"
    >
      <Image
        src={video.thumbnail}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 72vw"
        className="object-cover opacity-90"
        onError={onImageError}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      <div className="relative flex h-full min-h-[460px] flex-col justify-end p-6 md:min-h-[520px] md:p-9 lg:p-11">
        <div className="mb-auto flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-accent shadow-[0_0_12px_rgba(255,90,60,0.9)]" />
            En tendencia · Colombia
          </span>
        </div>

        <div className="max-w-3xl text-white">
          <h1 className="text-shadow-soft line-clamp-3 text-display text-[2rem] sm:text-[2.8rem] lg:text-[3.4rem]">
            {video.title}
          </h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/70">
            <span className="font-medium text-white/90">{video.channelTitle}</span>
            {video.publishedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatRelativeTime(video.publishedAt)}</span>
              </>
            ) : null}
            {video.durationSeconds ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatDuration(video.durationSeconds)}</span>
              </>
            ) : null}
            {video.liveBroadcastContent === "live" ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-semibold uppercase tracking-[0.14em] text-red-300">En vivo</span>
              </>
            ) : null}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              href={`/watch/${video.id}`}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              <Play className="size-4 fill-current" aria-hidden />
              Ver ahora
            </Link>
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              <Heart className={isFavorite ? "size-4 fill-red-400 text-red-400" : "size-4"} aria-hidden />
              {isFavorite ? "Guardado" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={onAskAi}
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              <Sparkles className="size-4" aria-hidden />
              Preguntar a TECLA AI
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialHero({ configured, error }: { configured: boolean; error?: string }) {
  const openWithPrompt = useAi((state) => state.openWithPrompt);

  return (
    <section
      aria-label="Bienvenida a TECLA LIVE"
      className="relative isolate min-h-[460px] overflow-hidden rounded-[2rem] border border-border bg-[#0a090d] shadow-[var(--shadow-float)] md:min-h-[520px]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_12%_0%,rgba(255,90,60,0.28),transparent_58%),radial-gradient(100%_90%_at_92%_18%,rgba(124,58,237,0.32),transparent_60%),linear-gradient(150deg,#121016_0%,#08070b_58%,#120b10_100%)]" />
      <div className="absolute -right-24 top-1/2 size-[540px] -translate-y-1/2 rounded-full border border-white/[0.07]" />
      <div className="absolute -right-10 top-1/2 size-[380px] -translate-y-1/2 rounded-full border border-white/[0.08]" />
      <div className="absolute right-16 top-1/2 size-[210px] -translate-y-1/2 rounded-full border border-accent/25 bg-accent/5 blur-[1px]" />
      <div className="absolute right-[8.5rem] top-1/2 size-24 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] opacity-90 blur-[2px]" />
      <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

      <div className="relative flex h-full min-h-[460px] flex-col justify-between p-6 text-white md:min-h-[520px] md:p-9 lg:p-11">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
            TECLA LIVE
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Hecho para tu Tesla
          </span>
        </div>

        <div className="max-w-2xl">
          <p className="eyebrow !text-white/55">Tu centro de entretenimiento</p>
          <h1 className="text-shadow-soft mt-3 text-display text-[2.5rem] sm:text-[3.4rem] lg:text-[4.4rem]">
            La función
            <br />
            empieza contigo.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 md:text-base">
            Videos, música, radio, podcasts y navegación con una sola voz. Todo lo que
            necesitas para disfrutar el camino.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Link
              href="/youtube"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              <Play className="size-4 fill-current" aria-hidden />
              Explorar videos
            </Link>
            <button
              type="button"
              onClick={() => openWithPrompt("¿Qué me recomiendas escuchar o ver hoy?")}
              className={buttonVariants({ variant: "glass", size: "lg" })}
            >
              <Sparkles className="size-4" aria-hidden />
              Hablar con TECLA AI
            </button>
          </div>

          {!configured && !error ? (
            <p className="mt-5 flex items-center gap-2 text-[11px] text-white/45">
              <TriangleAlert className="size-3.5" aria-hidden />
              YouTube se activa al configurar YOUTUBE_API_KEY. El resto de TECLA LIVE ya está listo.
            </p>
          ) : error ? (
            <p className="mt-5 flex items-center gap-2 text-[11px] text-amber-200/75">
              <TriangleAlert className="size-3.5" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
