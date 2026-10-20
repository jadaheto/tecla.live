import Link from "next/link";
import { cn } from "@/lib/utils";

export function TeclaLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="TECLA LIVE, ir al inicio"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className,
      )}
    >
      <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0c11] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]">
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
          <path d="M17 21h30" stroke="#f8f4eb" strokeWidth="5" strokeLinecap="round" />
          <path d="M32 21v25" stroke="#f8f4eb" strokeWidth="5" strokeLinecap="round" />
          <circle cx="48" cy="47" r="6" fill="#ff5a3c" />
        </svg>
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.2em] text-foreground">TECLA</span>
          <span className="mt-1 flex items-center gap-1.5 text-[9px] font-medium tracking-[0.34em] text-muted">
            LIVE
            <span className="inline-block size-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(255,90,60,0.9)]" />
          </span>
        </span>
      ) : null}
    </Link>
  );
}
