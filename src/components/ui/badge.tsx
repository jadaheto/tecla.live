import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "live" | "outline" | "warning" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        variant === "default" && "bg-surface text-muted",
        variant === "live" && "bg-red-500/15 text-red-400",
        variant === "outline" && "border border-border text-muted",
        variant === "warning" && "bg-amber-500/15 text-amber-500",
        variant === "success" && "bg-emerald-500/15 text-emerald-500",
        className,
      )}
      {...props}
    />
  );
}
