/**
 * Voces de ElevenLabs ofrecidas al público en Ajustes, configuradas por
 * variable de entorno para que ningún usuario necesite cuenta propia:
 *
 *   ELEVENLABS_VOICES="id|Nombre visible|grupo|género;id|Nombre|grupo|género"
 *
 * grupo: latino | hombres | mujeres · género: male | female.
 * La voz de ELEVENLABS_VOICE_ID sigue siendo la predeterminada. Si la
 * variable no existe, se usa la lista de respaldo de abajo (IDs públicos de
 * ElevenLabs; la clave de API nunca sale del servidor).
 */
export type CuratedVoiceGroup = "latino" | "hombres" | "mujeres";

export interface CuratedVoice {
  id: string;
  name: string;
  group: CuratedVoiceGroup;
  gender: "male" | "female";
}

export const CURATED_GROUP_LABELS: Record<CuratedVoiceGroup, string> = {
  latino: "Español latino · Colombia",
  hombres: "Hombres populares",
  mujeres: "Mujeres populares",
};

const GROUPS: readonly CuratedVoiceGroup[] = ["latino", "hombres", "mujeres"];
const VOICE_ID = /^[A-Za-z0-9]{10,40}$/;

export const FALLBACK_CURATED_VOICES: readonly CuratedVoice[] = [
  { id: "cAiEyIv3FkdNcqX4j2lu", name: "Alejandro · colombiano, sereno", group: "latino", gender: "male" },
  { id: "UiSSTkQfzyt8mQUKITpS", name: "Alberto · grave, formal", group: "latino", gender: "male" },
  { id: "qHkrJuifPpn95wK3rm2A", name: "Andrea · Medellín", group: "latino", gender: "female" },
  { id: "3Fx71T889APcHRu4VtQf", name: "Valentina · Medellín", group: "latino", gender: "female" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian · grave y envolvente", group: "hombres", gender: "male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George · narrador cálido", group: "hombres", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel · locutor formal", group: "hombres", gender: "male" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah · segura y madura", group: "mujeres", gender: "female" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice · clara y profesional", group: "mujeres", gender: "female" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda · profesional y animada", group: "mujeres", gender: "female" },
];

/** Parsea el formato de la variable de entorno; ignora entradas inválidas y duplicados. */
export function parseCuratedVoices(raw: string | undefined): CuratedVoice[] {
  if (!raw || !raw.trim()) return [];
  const seen = new Set<string>();
  const voices: CuratedVoice[] = [];
  for (const entry of raw.split(";")) {
    const parts = entry.split("|").map((part) => part.trim());
    const [id, name, group, gender] = parts;
    if (!id || !name || !VOICE_ID.test(id) || seen.has(id)) continue;
    const safeGroup = GROUPS.includes(group as CuratedVoiceGroup) ? (group as CuratedVoiceGroup) : "latino";
    const safeGender: "male" | "female" = gender === "female" || gender === "f" ? "female" : "male";
    seen.add(id);
    voices.push({ id, name: name.slice(0, 60), group: safeGroup, gender: safeGender });
  }
  return voices;
}

let cache: { raw: string | undefined; voices: CuratedVoice[] } | null = null;

export function getCuratedVoices(): CuratedVoice[] {
  const raw = process.env.ELEVENLABS_VOICES;
  if (cache && cache.raw === raw) return cache.voices;
  const parsed = parseCuratedVoices(raw);
  const voices = parsed.length > 0 ? parsed : [...FALLBACK_CURATED_VOICES];
  cache = { raw, voices };
  return voices;
}

const KITT_PREFERRED_IDS = ["UiSSTkQfzyt8mQUKITpS", "onwK4e9ZLuTAKqWW03F9", "nPczCjzI2devNBz1zQrb", "cAiEyIv3FkdNcqX4j2lu"];

/**
 * Voz para el estilo «El auto fantástico»: ELEVENLABS_KITT_VOICE_ID si está
 * definida; si no, la primera voz masculina grave de la lista curada.
 */
export function getKittVoiceId(): string | null {
  const fromEnv = process.env.ELEVENLABS_KITT_VOICE_ID?.trim();
  if (fromEnv && VOICE_ID.test(fromEnv)) return fromEnv;
  const voices = getCuratedVoices();
  for (const preferred of KITT_PREFERRED_IDS) {
    if (voices.some((voice) => voice.id === preferred)) return preferred;
  }
  return voices.find((voice) => voice.gender === "male")?.id ?? null;
}

export function isCuratedVoice(id: string): boolean {
  return getCuratedVoices().some((voice) => voice.id === id) || id === process.env.ELEVENLABS_KITT_VOICE_ID?.trim();
}
