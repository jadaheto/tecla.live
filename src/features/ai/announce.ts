"use client";

import { voicePayload } from "@/features/ai/voice-payload";
import { getMediaController } from "@/features/media/player-bridge";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/toast";

let current: HTMLAudioElement | null = null;

export type SpeechResult = "played" | "blocked" | "failed";

/**
 * Pide a /api/ai/tts la voz configurada para un texto y devuelve el audio
 * listo para reproducir (o `null` si la voz no está disponible). No suena solo.
 */
export async function synthesizeSpeech(text: string): Promise<HTMLAudioElement | null> {
  const clean = text.trim();
  if (!clean) return null;
  try {
    const response = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, ...voicePayload() }),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.size) return null;
    const audio = new Audio(URL.createObjectURL(blob));
    audio.volume = Math.min(1, Math.max(0, usePreferences.getState().volume / 100));
    return audio;
  } catch {
    return null;
  }
}

/**
 * Reproduce un audio de voz pausando la música mientras habla y reanudándola
 * al terminar. `blocked` significa que el navegador exige un toque antes de
 * sonar: el audio queda intacto para intentarlo tras la interacción.
 */
export async function playSpeech(audio: HTMLAudioElement): Promise<SpeechResult> {
  current?.pause();
  current = audio;
  const media = getMediaController();
  let resume = false;
  if (media?.getSnapshot().isPlaying) resume = (await media.pause()).ok;
  const finish = () => {
    URL.revokeObjectURL(audio.src);
    if (current === audio) current = null;
    if (resume) void media?.play().catch(() => undefined);
  };
  try {
    await audio.play();
  } catch (error) {
    if (resume) void media?.play().catch(() => undefined);
    const blocked = error instanceof DOMException && error.name === "NotAllowedError";
    if (!blocked) {
      URL.revokeObjectURL(audio.src);
      if (current === audio) current = null;
    }
    return blocked ? "blocked" : "failed";
  }
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  }).finally(finish);
  return "played";
}

/**
 * Aviso breve de TECLA AI fuera del HUD (batería baja, carga completa…):
 * muestra el texto y lo pronuncia con la voz configurada, pausando la música
 * mientras habla. Si el navegador bloquea el audio por falta de un toque, el
 * texto queda en pantalla igual. Nunca llama a DeepSeek: solo síntesis.
 */
export async function announce(text: string, options: { title?: string; speak?: boolean } = {}): Promise<boolean> {
  const clean = text.trim();
  if (!clean) return false;
  toast({ title: options.title ?? "Mi Tesla", description: clean, variant: "info" });
  const prefs = usePreferences.getState();
  if (options.speak === false || !prefs.voiceEnabled) return false;
  const audio = await synthesizeSpeech(clean);
  if (!audio) return false;
  return (await playSpeech(audio)) === "played";
}
