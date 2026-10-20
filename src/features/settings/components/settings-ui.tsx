import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
  aside,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 overflow-hidden rounded-[1.75rem] border border-border bg-surface/45",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 md:px-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  description,
  children,
  className,
  htmlFor,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
          {title}
        </label>
        {description ? (
          <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 sm:pl-6">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-11 items-center gap-0.5 rounded-full border border-border bg-surface p-1",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
              active
                ? "bg-surface-strong text-foreground shadow-sm ring-1 ring-inset ring-accent/35"
                : "text-muted hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-amber-400/80",
      )}
      aria-hidden
    />
  );
}
