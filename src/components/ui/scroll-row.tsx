"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollRow({
  children,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const update = React.useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 8);
    setCanScrollRight(max > 8 && node.scrollLeft < max - 8);
  }, []);

  React.useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.75, 320), behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollerRef}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 md:gap-4"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Desplazar a la izquierda"
          className="absolute -left-3 top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-[var(--glass-strong)] text-foreground shadow-lg backdrop-blur-xl transition-transform hover:scale-105 md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Desplazar a la derecha"
          className="absolute -right-3 top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-[var(--glass-strong)] text-foreground shadow-lg backdrop-blur-xl transition-transform hover:scale-105 md:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
