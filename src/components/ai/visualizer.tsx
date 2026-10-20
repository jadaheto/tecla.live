"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiVisualState } from "@/types";

export function AiOrb({
  size = "md",
  pulse = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        size === "sm" && "size-9",
        size === "md" && "size-12",
        size === "lg" && "size-20",
        className,
      )}
      aria-hidden
    >
      {pulse ? (
        <>
          <span className="ai-ring absolute inset-0 rounded-full border border-accent/45" />
          <span
            className="ai-ring absolute inset-0 rounded-full border border-violet/35"
            style={{ animationDelay: "1.1s" }}
          />
        </>
      ) : null}
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a6b] via-[#ff4d3d] to-[#7c2ae8] text-white shadow-[0_16px_44px_-14px_rgba(255,90,60,0.8)]",
          size === "sm" && "size-9",
          size === "md" && "size-11",
          size === "lg" && "size-[76px]",
        )}
      >
        <span className="absolute inset-x-1 top-1 h-1/2 rounded-full bg-white/20 blur-[6px]" />
        <Sparkles
          className={cn(
            "relative",
            size === "sm" && "size-4",
            size === "md" && "size-5",
            size === "lg" && "size-8",
          )}
        />
      </span>
    </span>
  );
}

export function Waveform({
  active = false,
  bars = 5,
  className,
}: {
  active?: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flex h-4 items-center gap-[3px]", className)}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={cn(
            "w-[2px] rounded-full bg-accent",
            active ? "wave-bar" : "opacity-40",
          )}
          style={{
            height: `${6 + ((index * 5) % 10)}px`,
            animationDelay: `${index * 0.12}s`,
          }}
        />
      ))}
    </span>
  );
}

export function statusLabel(status: AiVisualState): string {
  switch (status) {
    case "listening":
      return "Escuchando…";
    case "transcribing":
      return "Transcribiendo…";
    case "thinking":
      return "Pensando…";
    case "executing":
      return "Ejecutando…";
    case "speaking":
      return "Hablando…";
    case "error":
      return "Algo salió mal";
    default:
      return "En línea";
  }
}

export function statusColor(status: AiVisualState): string {
  switch (status) {
    case "listening":
    case "transcribing":
      return "bg-sky-400";
    case "thinking":
    case "executing":
      return "bg-amber-400";
    case "speaking":
      return "bg-emerald-400";
    case "error":
      return "bg-red-400";
    default:
      return "bg-emerald-400";
  }
}
