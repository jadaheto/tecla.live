"use client";

import * as React from "react";
import { useNow } from "@/hooks/use-now";
import { formatBogotaDate } from "@/lib/theme";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function Greeting() {
  const now = useNow();

  const hour = now
    ? Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          hour12: false,
          timeZone: "America/Bogota",
        }).format(now),
      )
    : 20;

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div>
        <p className="eyebrow mb-1.5">
          {now ? formatBogotaDate(now) : "TECLA LIVE · Bogotá"}
        </p>
        <h1 className="text-display text-[1.75rem] sm:text-[2.15rem] md:text-[2.5rem]">
          {greetingForHour(hour)}.{" "}
          <span className="text-muted">¿Qué disfrutamos hoy?</span>
        </h1>
      </div>
      <p className="hidden max-w-[300px] text-right text-[11px] leading-relaxed text-muted md:block">
        Tu entretenimiento, tus aplicaciones y TECLA AI en un solo lugar.
      </p>
    </div>
  );
}
