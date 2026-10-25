"use client";

import * as React from "react";
import Link from "next/link";
import { Play, type LucideIcon } from "lucide-react";
import { Greeting } from "@/components/dashboard/greeting";
import { WeatherFx } from "@/components/weather/weather-fx";
import { Hero } from "@/components/dashboard/hero";
import { WeatherCard } from "@/components/dashboard/weather-card";
import { AiSpotlight } from "@/components/dashboard/ai-spotlight";
import { QuickAccess } from "@/components/dashboard/quick-access";
import { MediaCard } from "@/components/media/media-card";
import { MediaRow } from "@/components/media/media-row";
import { buttonVariants } from "@/components/ui/button";
import { useLibrary } from "@/stores/library";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";
import type { DashboardSectionId } from "@/lib/catalog";
import type { MediaKind } from "@/types";

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

export function Dashboard() {
  const history = useLibrary((state) => state.history);
  const dashboardOrder = usePreferences((state) => state.dashboardOrder);

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

  };

  return (
    <div>
      <WeatherFx />
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
