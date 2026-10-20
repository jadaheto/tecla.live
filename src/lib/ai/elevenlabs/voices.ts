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
