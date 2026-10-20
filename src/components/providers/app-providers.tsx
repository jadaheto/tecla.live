"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeSync } from "@/components/providers/theme-sync";
import { KeyboardShortcuts } from "@/components/providers/keyboard-shortcuts";
import { usePreferences } from "@/stores/preferences";
import { useLibrary } from "@/stores/library";
import { useIptv } from "@/stores/iptv";
import { useAiMemory } from "@/stores/ai-memory";

export function AppProviders({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useLibrary.persist.rehydrate();
    void useIptv.persist.rehydrate();
    void useAiMemory.persist.rehydrate();
  }, []);

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 15 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={280} skipDelayDuration={120}>
        <ThemeSync />
        <KeyboardShortcuts />
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
