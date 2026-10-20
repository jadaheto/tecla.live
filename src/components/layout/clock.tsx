"use client";

import * as React from "react";
import { useNow } from "@/hooks/use-now";
import { formatBogotaDate, formatBogotaTime } from "@/lib/theme";

export function Clock() {
  const now = useNow();

  if (!now) {
    return (
      <div className="hidden min-w-[112px] flex-col items-end gap-1 md:flex" aria-hidden>
        <span className="h-5 w-14 rounded-md bg-surface" />
        <span className="h-3 w-24 rounded-md bg-surface" />
      </div>
    );
  }

  return (
    <div className="hidden flex-col items-end md:flex">
      <span className="font-mono text-[17px] font-medium leading-none tracking-tight text-foreground tabular-nums">
        {formatBogotaTime(now)}
      </span>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
        {formatBogotaDate(now)} · Bogotá
      </span>
    </div>
  );
}
