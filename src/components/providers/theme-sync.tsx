"use client";

import * as React from "react";
import { usePreferences } from "@/stores/preferences";
import { getBogotaMinutes, isWithinWindow, parseTimeToMinutes } from "@/lib/theme";

export function ThemeSync() {
  const theme = usePreferences((state) => state.theme);
  const visualStyle = usePreferences((state) => state.visualStyle);
  const autoThemeEnabled = usePreferences((state) => state.autoThemeEnabled);
  const autoThemeStart = usePreferences((state) => state.autoThemeStart);
  const autoThemeEnd = usePreferences((state) => state.autoThemeEnd);
  const displayMode = usePreferences((state) => state.displayMode);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const ambientBackground = usePreferences((state) => state.ambientBackground);

  React.useEffect(() => {
    const apply = () => {
      let dark = theme === "dark" || visualStyle === "cyberpunk";
      if (theme === "auto" && visualStyle !== "cyberpunk") {
        if (!autoThemeEnabled) {
          dark = true;
        } else {
          const start = parseTimeToMinutes(autoThemeStart);
          const end = parseTimeToMinutes(autoThemeEnd);
          dark =
            start === null || end === null
              ? true
              : start === end
                ? false
                : isWithinWindow(getBogotaMinutes(new Date()), start, end);
        }
      }
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };

    apply();
    const interval = window.setInterval(apply, 30_000);
    return () => window.clearInterval(interval);
  }, [theme, visualStyle, autoThemeEnabled, autoThemeStart, autoThemeEnd]);

  React.useEffect(() => {
    document.documentElement.dataset.style = visualStyle;
  }, [visualStyle]);

  React.useEffect(() => {
    document.documentElement.dataset.displayMode = displayMode;
  }, [displayMode]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("grain-hidden", !ambientBackground);
  }, [ambientBackground]);

  return null;
}
