import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-[0_14px_36px_-16px_rgb(255_90_60/0.85)] hover:brightness-105",
        secondary:
          "bg-surface-strong text-foreground shadow-[var(--shadow-card)] hover:brightness-[1.03]",
        glass:
          "glass text-foreground hover:bg-[var(--glass-strong)]",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface",
        ghost: "text-foreground hover:bg-surface",
        subtle: "bg-surface text-foreground hover:bg-[var(--glass)]",
        danger: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-[15px]",
        xl: "h-14 px-8 text-base",
        icon: "size-11",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
