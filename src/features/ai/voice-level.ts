"use client";

/**
 * Nivel de audio en tiempo real para el orbe de TECLA AI (0–1).
 * Lo escribe el hook de voz (micrófono al escuchar, voz sintetizada al
 * responder) y lo lee el orbe en cada cuadro sin pasar por React.
 */
export type VoiceLevelSource = "mic" | "tts" | null;

let level = 0;
let source: VoiceLevelSource = null;

export function setVoiceLevel(next: number, from: VoiceLevelSource = source): void {
  level = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
  source = from;
}

export function clearVoiceLevel(): void {
  level = 0;
  source = null;
}

export function getVoiceLevel(): { level: number; source: VoiceLevelSource } {
  return { level, source };
}
