"use client";

import * as React from "react";
import { useUi } from "@/stores/ui";
import { useAi } from "@/features/ai/store";
import { openAssistant } from "@/features/ai/open-assistant";

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
        const ai = useAi.getState();
        if (ai.panelOpen || ai.voiceOpen) {
          ai.setPanelOpen(false);
          ai.setVoiceOpen(false);
        } else {
          openAssistant();
        }
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
