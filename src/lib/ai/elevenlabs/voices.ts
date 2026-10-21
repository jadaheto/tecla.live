import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";

const VoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  labels: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  preview_url: z.string().optional(),
});

const VoicesSchema = z.object({
  voices: z.array(VoiceSchema).default([]),
});

export interface ElevenLabsVoice {
  id: string;
  name: string;
  category?: string;
  labels?: Record<string, string | number>;
}

interface CacheEntry {
  value: ElevenLabsVoice[];
  expiresAt: number;
}

const globalCache = globalThis as unknown as { __teclaVoices?: CacheEntry };

const nameCache = new Map<string, { name: string | null; expiresAt: number }>();

/** Nombre de una voz por ID (incluye voces de la biblioteca usadas sin añadirlas a la cuenta). */
export async function getElevenLabsVoiceName(id: string): Promise<string | null> {
  if (!serverConfig.elevenLabsApiKey || !id) return null;
  const cached = nameCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.name;
  let name: string | null = null;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`, {
      headers: { "xi-api-key": serverConfig.elevenLabsApiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (response.ok) {
      const parsed = VoiceSchema.safeParse(await response.json());
      if (parsed.success) name = parsed.data.name;
    }
  } catch {
    name = null;
  }
  nameCache.set(id, { name, expiresAt: Date.now() + 60 * 60_000 });
  return name;
}

export async function getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  if (!serverConfig.elevenLabsApiKey) return [];
  if (globalCache.__teclaVoices && globalCache.__teclaVoices.expiresAt > Date.now()) {
    return globalCache.__teclaVoices.value;
  }

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": serverConfig.elevenLabsApiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    logger.warn("elevenlabs.voices_failed", { status: response.status });
    throw new Error("ELEVENLABS_VOICES_FAILED");
  }
  const parsed = VoicesSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("ELEVENLABS_VOICES_INVALID");

  const voices = parsed.data.voices
    .map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels,
    }))
    .slice(0, 50);

  globalCache.__teclaVoices = { value: voices, expiresAt: Date.now() + 10 * 60_000 };
  return voices;
}
