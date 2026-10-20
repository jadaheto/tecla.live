"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useToasts } from "@/stores/toast";
import { cn } from "@/lib/utils";

const icons = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
  default: Info,
} as const;

export function Toaster() {
  const toasts = useToasts((state) => state.toasts);
  const dismiss = useToasts((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-3 right-3 z-[150] flex flex-col gap-2 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[380px]"
      role="region"
      aria-label="Notificaciones"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon = icons[item.variant];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl border border-border p-4 shadow-[var(--shadow-float)]"
              role={item.variant === "error" ? "alert" : "status"}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  item.variant === "error" && "text-red-400",
                  item.variant === "success" && "text-emerald-400",
                  (item.variant === "default" || item.variant === "info") && "text-accent",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Cerrar notificación"
                className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
