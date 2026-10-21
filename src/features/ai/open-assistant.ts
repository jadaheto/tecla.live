"use client";

import { useAi } from "@/features/ai/store";
import { usePreferences } from "@/stores/preferences";

/**
 * Abre TECLA AI con el modo que corresponde: solo voz (HUD flotante, sin
 * teclado) si «Escuchar al abrir» está activo, o el panel de texto si no.
 */
export function openAssistant(options?: { mode?: "voice" | "text"; prompt?: string }): void {
  const ai = useAi.getState();
  if (options?.prompt) {
    ai.setVoiceOpen(false);
    ai.openWithPrompt(options.prompt);
    return;
  }
  const mode = options?.mode ?? (usePreferences.getState().aiAutoListen ? "voice" : "text");
  if (mode === "voice") {
    ai.setPanelOpen(false);
    ai.setVoiceOpen(true);
  } else {
    ai.setVoiceOpen(false);
    ai.setPanelOpen(true);
  }
}
