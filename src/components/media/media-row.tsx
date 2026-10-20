import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScrollRow } from "@/components/ui/scroll-row";
import { cn } from "@/lib/utils";

export function MediaRow({
  title,
  subtitle,
  eyebrow,
  actionHref,
  actionLabel = "Ver todo",
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)} aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground md:text-[21px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted md:text-[13px]">{subtitle}</p>
          ) : null}
        </div>
        {actionHref ? (
          <Link
            href={actionHref}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            {actionLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <ScrollRow ariaLabel={title}>{children}</ScrollRow>
    </section>
  );
}
