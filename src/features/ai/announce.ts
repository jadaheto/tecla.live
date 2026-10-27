"use client";

import { voicePayload } from "@/features/ai/voice-payload";
import { getMediaController } from "@/features/media/player-bridge";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/toast";

let current: HTMLAudioElement | null = null;

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

  try {
    const response = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, ...voicePayload() }),
    });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob.size) return false;
    current?.pause();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = Math.min(1, Math.max(0, prefs.volume / 100));
    current = audio;
    const media = getMediaController();
    let resume = false;
    if (media?.getSnapshot().isPlaying) resume = (await media.pause()).ok;
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio"));
      audio.play().catch(reject);
    }).finally(() => {
      URL.revokeObjectURL(url);
      if (current === audio) current = null;
      if (resume) void media?.play().catch(() => undefined);
    });
    return true;
  } catch {
    return false;
  }
}
