import type { VisualStyle } from "@/types";

/**
 * Secuencia de arranque «tipo nave»: chequeo de sistemas con el estado real
 * de cada integración (nada se inventa: lo que no está configurado aparece
 * como apagado). Lógica pura; la cortinilla solo la dibuja.
 */
export type BootStepState = "ok" | "warn" | "off";

export interface BootStep {
  id: string;
  label: string;
  detail: string;
  state: BootStepState;
}

export interface BootInput {
  integrations: {
    deepseek: boolean;
    deepgram: boolean;
    elevenlabs: boolean;
    spotify: boolean;
    youtube: boolean;
    tesla?: boolean;
  } | null;
  weather: { temperature: number; label: string; location: string } | null;
  /** `null` cuando aún no se sabe si la cuenta de Spotify está vinculada. */
  spotifyLinked: boolean | null;
  /** Vehículo: `null` si no se sabe aún; solo aparece cuando la Fleet API está configurada. */
  tesla?: { linked: boolean | null; batteryPercent: number | null; charging: boolean; asleep: boolean } | null;
  secureContext: boolean;
  geolocation: boolean;
  nowPlaying: string | null;
  wakeWord: boolean;
}

export function buildBootSteps(input: BootInput): BootStep[] {
  const steps: BootStep[] = [];
  const ai = input.integrations;

  steps.push(
    input.weather
      ? {
          id: "weather",
          label: "Clima",
          detail: `${Math.round(input.weather.temperature)}° · ${input.weather.label} · ${input.weather.location.split(",")[0]?.trim() ?? input.weather.location}`,
          state: "ok",
        }
      : { id: "weather", label: "Clima", detail: "Sin datos por ahora", state: "warn" },
  );

  steps.push(
    ai === null
      ? { id: "ai", label: "TECLA AI", detail: "Comprobando…", state: "warn" }
      : ai.deepseek
        ? { id: "ai", label: "TECLA AI", detail: "Copiloto en línea", state: "ok" }
        : { id: "ai", label: "TECLA AI", detail: "Sin configurar en el servidor", state: "off" },
  );

  const voiceOut = ai?.elevenlabs ?? false;
  const voiceIn = ai?.deepgram ?? false;
  steps.push(
    voiceOut && voiceIn
      ? { id: "voice", label: "Voz", detail: input.wakeWord ? "Habla y escucha · «Oye TECLA» activo" : "Habla y escucha", state: "ok" }
      : voiceOut || voiceIn
        ? { id: "voice", label: "Voz", detail: voiceOut ? "Solo síntesis de voz" : "Solo reconocimiento", state: "warn" }
        : { id: "voice", label: "Voz", detail: "Sin configurar", state: "off" },
  );

  steps.push(
    ai === null || !ai.spotify
      ? { id: "spotify", label: "Spotify", detail: "No configurado", state: "off" }
      : input.spotifyLinked === true
        ? { id: "spotify", label: "Spotify", detail: "Cuenta vinculada", state: "ok" }
        : input.spotifyLinked === false
          ? { id: "spotify", label: "Spotify", detail: "Cuenta sin vincular", state: "warn" }
          : { id: "spotify", label: "Spotify", detail: "Comprobando…", state: "warn" },
  );

  if (ai?.tesla) {
    const tesla = input.tesla ?? null;
    steps.push(
      tesla === null || tesla.linked === null
        ? { id: "tesla", label: "Tesla", detail: "Comprobando…", state: "warn" }
        : !tesla.linked
          ? { id: "tesla", label: "Tesla", detail: "Cuenta sin vincular", state: "warn" }
          : tesla.asleep
            ? { id: "tesla", label: "Tesla", detail: "Vehículo durmiendo", state: "ok" }
            : tesla.batteryPercent !== null
              ? { id: "tesla", label: "Tesla", detail: `Batería ${tesla.batteryPercent}%${tesla.charging ? " · cargando" : ""}`, state: "ok" }
              : { id: "tesla", label: "Tesla", detail: "Cuenta vinculada", state: "ok" },
    );
  }

  steps.push(
    ai?.youtube
      ? { id: "youtube", label: "YouTube", detail: "Búsqueda y tendencias", state: "ok" }
      : { id: "youtube", label: "YouTube", detail: "Sin clave de API", state: "off" },
  );

  steps.push(
    !input.geolocation
      ? { id: "gps", label: "GPS", detail: "No disponible en este navegador", state: "off" }
      : input.secureContext
        ? { id: "gps", label: "GPS", detail: "Disponible para TECLA Drive", state: "ok" }
        : { id: "gps", label: "GPS", detail: "Requiere HTTPS", state: "warn" },
  );

  steps.push(
    input.nowPlaying
      ? { id: "audio", label: "Audio", detail: `Sonando: ${input.nowPlaying}`, state: "ok" }
      : { id: "audio", label: "Audio", detail: "En silencio", state: "ok" },
  );

  return steps;
}

export interface BootTitles {
  eyebrow: string;
  title: string;
  ready: string;
}

/** Textos de la cortinilla según el estilo visual. */
export function bootTitles(style: VisualStyle): BootTitles {
  switch (style) {
    case "cyberpunk":
      return { eyebrow: "Night City OS", title: "Secuencia de arranque", ready: "Conectado" };
    case "kitt":
      return { eyebrow: "Knight Industries", title: "Activando sistemas", ready: "KITT en línea" };
    case "roadster":
      return { eyebrow: "Pre-flight", title: "Chequeo de cabina", ready: "Listo para despegar" };
    case "discovery":
      return { eyebrow: "Computadora de a bordo", title: "Diagnóstico de sistemas", ready: "Todos los sistemas operativos" };
    default:
      return { eyebrow: "TECLA LIVE", title: "Iniciando sistemas", ready: "Todo listo" };
  }
}

/** Duración de la secuencia (ms) según cantidad de pasos y «Reducir animaciones». */
export function bootDuration(stepCount: number, reduceMotion: boolean): { stepMs: number; holdMs: number; totalMs: number } {
  const stepMs = reduceMotion ? 70 : 230;
  const holdMs = reduceMotion ? 500 : 1_100;
  return { stepMs, holdMs, totalMs: 500 + stepCount * stepMs + holdMs };
}
