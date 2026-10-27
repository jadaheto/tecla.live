"use client";

import { getKittVoiceId } from "@/features/ai/kitt-voice";
import { usePreferences } from "@/stores/preferences";

/** Voz a pedir a /api/ai/tts: la elegida en Ajustes o, en el estilo KITT, la voz grave de KITT. */
export function voicePayload(): { voiceId?: string } {
  const prefs = usePreferences.getState();
  if (prefs.aiVoiceId) return { voiceId: prefs.aiVoiceId };
  if (prefs.visualStyle === "kitt") {
    const kitt = getKittVoiceId();
    if (kitt) return { voiceId: kitt };
  }
  return {};
}
