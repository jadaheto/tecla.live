import { z } from "zod";
import { TOOL_SCHEMAS, type ToolName } from "@/features/ai/tools/schemas";

export type ToolExecution = "server" | "client";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  execution: ToolExecution;
  schema: z.ZodType;
}

export const CLIENT_TOOL_NAMES: ReadonlySet<ToolName> = new Set<ToolName>([
  "play_youtube",
  "pause_media",
  "resume_media",
  "next_video",
  "add_favorite",
  "show_favorites",
  "open_app",
  "search_waze",
  "open_google_maps",
  "set_theme",
  "set_visual_style",
  "set_display_mode",
  "request_fullscreen",
  "play_radio",
  "open_spotify",
  "drive_control",
  "get_playback_state",
  "remember_preference",
]);

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_youtube",
    execution: "server",
    description:
      "Busca videos reales en YouTube y devuelve sus IDs y metadatos. Úsala antes de play_youtube cuando el usuario pida contenido por tema. Para música, prefiere el canal oficial y evita compilaciones o fan edits; los videos marcados como no embebibles se omiten.",
    schema: TOOL_SCHEMAS.search_youtube,
  },
  {
    name: "play_youtube",
    execution: "client",
    description:
      "Abre el reproductor de TECLA LIVE con un video de YouTube concreto. Solo acepta IDs válidos; no inventes identificadores.",
    schema: TOOL_SCHEMAS.play_youtube,
  },
  {
    name: "pause_media",
    execution: "client",
    description: "Pausa el reproductor activo controlado por TECLA LIVE.",
    schema: TOOL_SCHEMAS.pause_media,
  },
  {
    name: "resume_media",
    execution: "client",
    description: "Reanuda el reproductor activo controlado por TECLA LIVE.",
    schema: TOOL_SCHEMAS.resume_media,
  },
  {
    name: "next_video",
    execution: "client",
    description: "Reproduce el siguiente elemento de la cola de TECLA LIVE.",
    schema: TOOL_SCHEMAS.next_video,
  },
  {
    name: "add_favorite",
    execution: "client",
    description:
      "Guarda un elemento real como favorito en la biblioteca local. No lo uses con contenido inventado.",
    schema: TOOL_SCHEMAS.add_favorite,
  },
  {
    name: "show_favorites",
    execution: "client",
    description: "Abre la pantalla de favoritos y biblioteca del usuario.",
    schema: TOOL_SCHEMAS.show_favorites,
  },
  {
    name: "open_app",
    execution: "client",
    description:
      "Abre una aplicación permitida de TECLA LIVE. No puede abrir URLs arbitrarias.",
    schema: TOOL_SCHEMAS.open_app,
  },
  {
    name: "search_waze",
    execution: "client",
    description:
      "Prepara una búsqueda de destino en Waze dentro de TECLA LIVE. La navegación real y los avisos de huecos, cámaras y policía solo se muestran en Waze; TECLA LIVE no los recibe.",
    schema: TOOL_SCHEMAS.search_waze,
  },
  {
    name: "open_google_maps",
    execution: "client",
    description: "Abre la búsqueda de un destino en Google Maps.",
    schema: TOOL_SCHEMAS.open_google_maps,
  },
  {
    name: "set_theme",
    execution: "client",
    description: "Cambia el tema de TECLA LIVE a claro, oscuro o automático.",
    schema: TOOL_SCHEMAS.set_theme,
  },
  {
    name: "set_visual_style",
    execution: "client",
    description:
      "Cambia el estilo visual de TECLA LIVE: «tecla» (normal), «cyberpunk» (Cyberpunk 2077: tipografía Rajdhani, neón amarillo y cian, scanlines) «discovery» (puente de nave estelar: hologramas azul cian, computadora de la nave), «kitt» (El auto fantástico / Knight Rider: negro, escáner rojo, ámbar, tipografía Orbitron; activa la personalidad y la voz de KITT) o «roadster» (cabina de caza del Tesla Roadster: rojo monocromo sobre negro, rejilla de puntos, retícula de radar; activa la personalidad de copiloto de vuelo).",
    schema: TOOL_SCHEMAS.set_visual_style,
  },
  {
    name: "set_display_mode",
    execution: "client",
    description: "Cambia el modo de pantalla: normal, cine, kiosco, audio (modo conducción del reproductor de YouTube: carátula y controles grandes mientras suena el audio) o ambient (pantalla ambiente con reloj, clima y carátula; «pon la pantalla ambiente», «modo reposo»).",
    schema: TOOL_SCHEMAS.set_display_mode,
  },
  {
    name: "request_fullscreen",
    execution: "client",
    description:
      "Solicita pantalla completa. El navegador puede bloquearla si no proviene de un gesto del usuario.",
    schema: TOOL_SCHEMAS.request_fullscreen,
  },
  {
    name: "search_radio",
    execution: "server",
    description:
      "Busca emisoras de radio reales en el directorio Radio Browser. Devuelve IDs utilizables por play_radio.",
    schema: TOOL_SCHEMAS.search_radio,
  },
  {
    name: "play_radio",
    execution: "client",
    description: "Reproduce una emisora real devuelta por search_radio, usando su ID.",
    schema: TOOL_SCHEMAS.play_radio,
  },
  {
    name: "search_podcasts",
    execution: "server",
    description: "Busca episodios de podcast reales en el directorio de iTunes.",
    schema: TOOL_SCHEMAS.search_podcasts,
  },
  {
    name: "get_weather",
    execution: "server",
    description:
      "Consulta el clima actual real de Sincelejo o de otra ciudad. No inventes temperaturas.",
    schema: TOOL_SCHEMAS.get_weather,
  },
  {
    name: "get_vehicle_status",
    execution: "server",
    description:
      "Consulta el estado real del Tesla del usuario vía Fleet API: batería, autonomía, carga, temperatura, bloqueo. Úsala para «¿cuánta batería tengo?», «¿está cargando?», «¿cuánto falta?». Si el auto duerme, dilo; no inventes cifras.",
    schema: TOOL_SCHEMAS.get_vehicle_status,
  },
  {
    name: "get_playback_state",
    execution: "client",
    description:
      "Consulta el estado real del reproductor activo de TECLA LIVE antes de responder sobre lo que suena.",
    schema: TOOL_SCHEMAS.get_playback_state,
  },
  {
    name: "open_spotify",
    execution: "client",
    description: "Abre la sección de música y Spotify de TECLA LIVE.",
    schema: TOOL_SCHEMAS.open_spotify,
  },
  {
    name: "drive_control",
    execution: "client",
    description:
      "Controla TECLA Drive (simulador de sonido de motor y paisaje): abrirlo, encender o apagar el motor, cambiar el motor (IDs: v8_biturbo, v8_plano, v8_biturbo_sport, v8_compresor_62, rotativo_turbo, seis_linea_turbo, boxer_rally, v12_pista, v10_sport, v8_pushrod, v8_pushrod_compresor, v8_compresor_52, seis_linea_itb, cuatro_formula, v6_hot_v, v6_biturbo, v8_gt3, v8_big_block, v8_sport, ev_trimotor, ev_inverter, hover, warp, crucero_estelar, fantasma, cyber) o la escena. Encender el audio puede requerir un toque del usuario; informa el resultado real.",
    schema: TOOL_SCHEMAS.drive_control,
  },
  {
    name: "remember_preference",
    execution: "client",
    description:
      "Guarda una preferencia duradera solo si el usuario lo pide o confirma explícitamente y la memoria está activada. Nunca guardes secretos, salud, ubicación exacta ni datos sensibles.",
    schema: TOOL_SCHEMAS.remember_preference,
  },
  {
    name: "search_spotify",
    execution: "server",
    description:
      "Busca canciones, álbumes o artistas reales en Spotify del usuario conectado y devuelve sus URIs. Úsala antes de play_spotify cuando pidan una canción concreta. Requiere cuenta vinculada.",
    schema: TOOL_SCHEMAS.search_spotify,
  },
  {
    name: "play_spotify",
    execution: "server",
    description:
      "Reproduce en Spotify un URI exacto devuelto por search_spotify, en el reproductor web de TECLA LIVE si está activo o en el dispositivo activo del usuario. Requiere cuenta vinculada y Premium.",
    schema: TOOL_SCHEMAS.play_spotify,
  },
  {
    name: "spotify_control",
    execution: "server",
    description:
      "Controla Spotify del usuario conectado (play, pause, next, previous, volume). Requiere cuenta vinculada y permisos vigentes.",
    schema: TOOL_SCHEMAS.spotify_control,
  },
];

export const TOOL_BY_NAME = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

export function isToolName(value: string): value is ToolName {
  return value in TOOL_SCHEMAS;
}

export function buildDeepSeekTools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOL_DEFINITIONS.map((tool) => {
    const jsonSchema = z.toJSONSchema(tool.schema, { target: "draft-7" }) as Record<
      string,
      unknown
    >;
    delete jsonSchema.$schema;
    if (!jsonSchema.type) jsonSchema.type = "object";
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      },
    };
  });
}
