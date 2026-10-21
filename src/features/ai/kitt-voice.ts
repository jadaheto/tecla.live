"use client";

/**
 * Voz recomendada para el estilo «El auto fantástico». El servidor la elige
 * (ELEVENLABS_KITT_VOICE_ID o la primera voz masculina grave curada); el
 * cliente la consulta una vez y la recuerda para no repetir la petición.
 */
let cached: string | null | undefined;
let pending: Promise<string | null> | null = null;

export function getKittVoiceId(): string | null {
  if (cached !== undefined) return cached;
  void prefetchKittVoiceId();
  return null;
}

export function prefetchKittVoiceId(): Promise<string | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (pending) return pending;
  if (typeof window === "undefined") return Promise.resolve(null);
  pending = fetch("/api/ai/voices/public")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { data?: { kittVoiceId?: string | null }; kittVoiceId?: string | null } | null) => {
      const id = payload?.data?.kittVoiceId ?? payload?.kittVoiceId ?? null;
      cached = typeof id === "string" && id ? id : null;
      return cached;
    })
    .catch(() => {
      cached = undefined;
      return null;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Solo para pruebas. */
export function resetKittVoiceCache(): void {
  cached = undefined;
  pending = null;
}
