"use client";

import * as React from "react";
import { useUi } from "@/stores/ui";

export function KeyboardShortcuts() {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUi.getState().setSearchOpen(!useUi.getState().searchOpen);
        return;
      }
      if (modifier && event.key.toLowerCase() === "j") {
        event.preventDefault();
        useUi.getState().setAiOpen(!useUi.getState().aiOpen);
        return;
      }
      if (!typing && event.key === "?") {
        event.preventDefault();
        useUi.getState().setShortcutsOpen(!useUi.getState().shortcutsOpen);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
