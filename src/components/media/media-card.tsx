"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import Link from "next/link";
import {
  Heart,
  ListVideo,
  Play,
  Podcast,
  Radio,
  Sparkles,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { useLibrary } from "@/stores/library";
import { toast } from "@/stores/toast";
import { cn, formatDuration } from "@/lib/utils";
import type { MediaKind } from "@/types";

export interface MediaCardData {
  kind: MediaKind;
  providerId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  href: string;
  progressPercent?: number;
  durationSeconds?: number;
  live?: boolean;
  badge?: string;
}

const kindIcon: Record<MediaKind, LucideIcon> = {
  youtube: Play,
  radio: Radio,
  podcast: Podcast,
  channel: Tv,
  playlist: ListVideo,
  iptv: Tv,
  app: Sparkles,
  destination: Play,
};

function radioHue(id: string): number {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) {
    value = (value * 31 + id.charCodeAt(index)) % 360;
  }
  return value;
}

const gradients: Record<MediaKind, string> = {
  youtube: "from-[#ff3b3b]/70 via-[#66101a] to-[#1a0609]",
  radio: "from-[#f6b756]/80 via-[#7c4a13] to-[#241203]",
  podcast: "from-[#ff9a76]/80 via-[#8e2c44] to-[#240912]",
  channel: "from-[#7ea8ff]/80 via-[#293e8f] to-[#0a0f2a]",
  playlist: "from-[#b18cff]/80 via-[#4e2b8f] to-[#150829]",
  iptv: "from-[#b18cff]/80 via-[#3b1b77] to-[#120524]",
  app: "from-[#ff8a5c]/80 via-[#7c2ae8]/70 to-[#140822]",
  destination: "from-[#5eead4]/80 via-[#0f766e] to-[#04211d]",
};

export function MediaCard({
  item,
  className,
  aspect = "video",
  showFavorite = true,
  compact = false,
}: {
  item: MediaCardData;
  className?: string;
  aspect?: "video" | "square";
  showFavorite?: boolean;
  compact?: boolean;
}) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const isFavorite = useLibrary((state) =>
    state.favorites.some(
      (favorite) => favorite.kind === item.kind && favorite.providerId === item.providerId,
    ),
  );
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);
  const Icon = kindIcon[item.kind];

  const showImage =
    Boolean(item.imageUrl) && failedUrl !== item.imageUrl && item.kind !== "radio";

  function onFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const added = toggleFavorite({
      kind: item.kind,
      providerId: item.providerId,
      title: item.title,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      href: item.href,
    });
    toast({
      title: added ? "Añadido a favoritos" : "Quitado de favoritos",
      description: added ? item.title : undefined,
      variant: added ? "success" : "info",
    });
  }

  const content = (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-surface shadow-[var(--shadow-card)]",
          aspect === "video" ? "aspect-video" : "aspect-square",
        )}
      >
        {item.kind === "radio" ? (
          <div
            className="absolute inset-0 flex flex-col justify-between p-4 text-white"
            style={{
              background: `radial-gradient(120% 100% at 15% 0%, hsl(${radioHue(
                item.providerId,
              )} 58% 32%), transparent 62%), linear-gradient(145deg, hsl(${radioHue(
                item.providerId,
              )} 42% 20%), #0b0809 82%)`,
            }}
          >
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
                {showImage ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedUrl(item.imageUrl ?? null)}
                    className="size-full object-cover"
                  />
                ) : (
                  <Icon className="size-5" aria-hidden />
                )}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                En vivo
              </span>
            </div>
            <div>
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-white/95">
                {item.title}
              </p>
              <p className="mt-1 text-[10px] text-white/55">Radio en vivo</p>
            </div>
          </div>
        ) : showImage ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(item.imageUrl ?? null)}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-between bg-gradient-to-br p-4",
              gradients[item.kind],
            )}
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/12 text-white backdrop-blur">
                <Icon className="size-4" aria-hidden />
              </span>
              {item.live ? (
                <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                  En vivo
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-white/95">
              {item.subtitle ?? "TECLA LIVE"}
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {item.live && showImage ? (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            En vivo
          </span>
        ) : item.badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            {item.badge}
          </span>
        ) : null}

        {item.durationSeconds ? (
          <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white tabular-nums backdrop-blur">
            {formatDuration(item.durationSeconds)}
          </span>
        ) : null}

        {typeof item.progressPercent === "number" && item.progressPercent > 0 ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
            <span
              className="block h-full rounded-r-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
            />
          </span>
        ) : null}

        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-black shadow-xl">
            <Play className="ml-0.5 size-5 fill-current" aria-hidden />
          </span>
        </span>
      </div>

      <div className={cn("mt-3 px-0.5", compact && "mt-2.5")}>
        <p
          className={cn(
            "line-clamp-2 font-medium leading-snug text-foreground",
            compact ? "text-[13px]" : "text-sm",
          )}
        >
          {item.title}
        </p>
        {item.subtitle ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-muted">{item.subtitle}</p>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "group relative shrink-0 snap-start",
        aspect === "video"
          ? "w-[248px] sm:w-[286px] xl:w-[316px]"
          : "w-[168px] sm:w-[186px]",
        className,
      )}
    >
      {item.href.startsWith("http") ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          {content}
        </a>
      ) : (
        <Link
          href={item.href}
          className="block rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          {content}
        </Link>
      )}

      {showFavorite ? (
        <button
          type="button"
          onClick={onFavorite}
          aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-pressed={isFavorite}
          className={cn(
            "absolute right-2.5 top-2.5 flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            isFavorite ? "opacity-100" : "opacity-80 sm:opacity-0 sm:group-hover:opacity-100",
            item.live || item.badge ? "top-auto bottom-2.5 sm:top-2.5" : "",
          )}
        >
          <Heart className={cn("size-4", isFavorite && "fill-red-400 text-red-400")} />
        </button>
      ) : null}
    </div>
  );
}
