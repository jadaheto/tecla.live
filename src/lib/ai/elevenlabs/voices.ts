import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";

// ElevenLabs añade campos y devuelve nulos sin previo aviso: solo se exige id y nombre.
const VoiceSchema = z.looseObject({
  voice_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().nullish(),
  labels: z.record(z.string(), z.unknown()).nullish(),
  preview_url: z.string().nullish(),
});

const VoicesSchema = z.looseObject({
  voices: z.array(z.unknown()).nullish(),
});

/** Convierte la respuesta de /v1/voices en voces válidas; descarta entradas raras sin fallar. */
export function parseVoicesPayload(payload: unknown): { voices: ElevenLabsVoice[]; skipped: number } {
  const parsed = VoicesSchema.safeParse(payload);
  if (!parsed.success) throw new Error("ELEVENLABS_VOICES_INVALID");
  const voices: ElevenLabsVoice[] = [];
  let skipped = 0;
  for (const item of parsed.data.voices ?? []) {
    const voice = VoiceSchema.safeParse(item);
    if (!voice.success) {
      skipped += 1;
      continue;
    }
    const labels: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(voice.data.labels ?? {})) {
      if (typeof value === "string" || typeof value === "number") labels[key] = value;
    }
    voices.push({
      id: voice.data.voice_id,
      name: voice.data.name,
      category: voice.data.category ?? undefined,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    });
  }
  return { voices: voices.slice(0, 50), skipped };
}

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
  const payload: unknown = await response.json();
  let voices: ElevenLabsVoice[];
  try {
    const result = parseVoicesPayload(payload);
    voices = result.voices;
    if (result.skipped > 0) logger.warn("elevenlabs.voices_skipped", { skipped: result.skipped });
  } catch (error) {
    logger.warn("elevenlabs.voices_invalid", {
      type: payload === null ? "null" : Array.isArray(payload) ? "array" : typeof payload,
      keys: payload && typeof payload === "object" ? Object.keys(payload as object).slice(0, 8) : [],
    });
    throw error;
  }

  globalCache.__teclaVoices = { value: voices, expiresAt: Date.now() + 10 * 60_000 };
  return voices;
}
