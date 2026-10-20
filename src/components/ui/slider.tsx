"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted/20">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-6 rounded-full border-2 border-accent bg-background shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-110" />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";

export { Slider };
