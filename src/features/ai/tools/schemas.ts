import { z } from "zod";

export const ALLOWED_APP_IDS = [
  "youtube",
  "spotify",
  "drive",
  "tesla",
  "chargers",
  "waze",
  "maps",
  "netflix",
  "disney",
  "radio",
  "iptv",
  "podcasts",
  "twitch",
] as const;

export const FAVORITE_KINDS = ["youtube", "radio", "podcast", "channel", "iptv"] as const;

export const SearchYoutubeArgs = z
  .object({
    query: z.string().trim().min(2).max(120).describe("Tema o frase a buscar en YouTube."),
    limit: z.number().int().min(1).max(10).default(5).describe("Cantidad máxima de resultados."),
    region: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .default("CO")
      .describe("Código de país ISO de dos letras, por defecto CO."),
  })
  .strict();

export const PlayYoutubeArgs = z
  .object({
    videoId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{6,20}$/)
      .describe("Identificador exacto del video de YouTube."),
    title: z.string().trim().max(200).optional().describe("Título conocido del video, si existe."),
  })
  .strict();

export const PauseMediaArgs = z.object({}).strict();
export const ResumeMediaArgs = z.object({}).strict();
export const NextVideoArgs = z.object({}).strict();

export const AddFavoriteArgs = z
  .object({
    kind: z.enum(FAVORITE_KINDS).describe("Tipo de contenido."),
    providerId: z.string().trim().min(1).max(200).describe("ID del contenido en su proveedor."),
    title: z.string().trim().min(1).max(200).describe("Título visible del contenido."),
    subtitle: z.string().trim().max(200).optional().describe("Canal, emisora o podcast."),
    imageUrl: z.string().url().max(500).optional().describe("URL de imagen https del contenido."),
  })
  .strict();

export const ShowFavoritesArgs = z.object({}).strict();

export const OpenAppArgs = z
  .object({
    appId: z.enum(ALLOWED_APP_IDS).describe("Aplicación permitida de TECLA LIVE."),
  })
  .strict();

export const SearchWazeArgs = z
  .object({
    destination: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .describe("Destino, lugar o dirección a preparar en Waze."),
  })
  .strict();

export const OpenGoogleMapsArgs = z
  .object({
    destination: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .describe("Destino o lugar a buscar en Google Maps."),
  })
  .strict();

export const SetThemeArgs = z
  .object({
    theme: z.enum(["light", "dark", "auto"]).describe("Tema visual solicitado."),
  })
  .strict();

export const SetVisualStyleArgs = z
  .object({
    style: z
      .enum(["tecla", "cyberpunk", "kitt", "roadster", "discovery"])
      .describe(
        "Estilo visual: «tecla» (identidad normal), «cyberpunk» (Cyberpunk 2077, neón amarillo y cian), «kitt» (El auto fantástico: negro, escáner rojo, ámbar, personalidad y voz de KITT), «roadster» (cabina de caza del Tesla Roadster: rojo monocromo sobre negro, personalidad de copiloto de vuelo) o «discovery» (puente de nave estelar al estilo de Star Trek: Discovery: hologramas azul cian, personalidad de computadora de la nave que trata al usuario de capitán).",
      ),
  })
  .strict();

export const SetDisplayModeArgs = z
  .object({
    mode: z
      .enum(["normal", "cinema", "kiosk", "audio", "ambient"])
      .describe("Modo de pantalla: normal, cine, kiosco, «audio» (modo conducción: carátula y controles sobre el video de YouTube, útil porque el Tesla bloquea el video en marcha) o «ambient» (pantalla ambiente: reloj, clima y carátula sobre fondo oscuro, para el auto detenido o cargando)."),
  })
  .strict();

export const RequestFullscreenArgs = z.object({}).strict();

export const SearchRadioArgs = z
  .object({
    query: z.string().trim().max(80).optional().describe("Género, ciudad o nombre de emisora."),
    limit: z.number().int().min(1).max(10).default(6).describe("Cantidad de emisoras."),
  })
  .strict();

export const PlayRadioArgs = z
  .object({
    stationId: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe("ID de una emisora devuelta por search_radio."),
  })
  .strict();

export const SearchPodcastsArgs = z
  .object({
    query: z.string().trim().min(2).max(120).describe("Tema o nombre del podcast."),
    limit: z.number().int().min(1).max(10).default(6),
  })
  .strict();

export const GetVehicleStatusArgs = z
  .object({
    refresh: z.boolean().optional().describe("true para forzar una lectura nueva en lugar de la caché de 2 minutos."),
  })
  .strict();

export const GetWeatherArgs = z
  .object({
    location: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional()
      .describe("Ciudad o lugar. Si se omite, se usa Sincelejo, Colombia."),
  })
  .strict();

export const GetPlaybackStateArgs = z.object({}).strict();

export const OpenSpotifyArgs = z.object({}).strict();

export const SpotifyControlArgs = z
  .object({
    action: z.enum(["play", "pause", "next", "previous", "volume"]),
    volume: z.number().int().min(0).max(100).optional().describe("Volumen solo para action=volume."),
  })
  .strict();

export const SearchSpotifyArgs = z
  .object({
    query: z.string().trim().min(2).max(120).describe("Canción, artista o álbum a buscar en Spotify."),
    limit: z.number().int().min(1).max(10).default(5).describe("Cantidad máxima de resultados."),
  })
  .strict();

export const PlaySpotifyArgs = z
  .object({
    uri: z
      .string()
      .trim()
      .regex(/^spotify:(track|album|playlist|artist):[A-Za-z0-9]{10,40}$/)
      .describe("URI exacto devuelto por search_spotify (spotify:track:…)."),
    title: z.string().trim().max(200).optional().describe("Título conocido, para confirmar al usuario."),
  })
  .strict();

export const DriveControlArgs = z
  .object({
    action: z
      .enum(["open", "engine_on", "engine_off", "set_engine", "set_scene"])
      .describe("Acción sobre TECLA Drive."),
    engineId: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{2,40}$/)
      .optional()
      .describe("ID de motor de TECLA Drive (por ejemplo v8_biturbo, v12_pista, rotativo_turbo, ev_trimotor)."),
    sceneId: z
      .enum(["halloween", "neon", "canyon", "coast", "alpine", "aurora", "galaxy", "stars", "plaid", "portal", "christmas", "rainy_city", "city_day"])
      .optional()
      .describe("Escena de TECLA Drive."),
  })
  .strict();

export const RememberPreferenceArgs = z
  .object({
    key: z
      .enum(["musica", "videos", "emisoras", "apps", "tema", "idioma", "ciudad", "motor", "escena", "podcast", "artista", "horario"])
      .describe("Categoría de la preferencia."),
    value: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .describe("Preferencia concreta que el usuario confirmó. No guardes datos sensibles."),
  })
  .strict();

export const TOOL_SCHEMAS = {
  search_youtube: SearchYoutubeArgs,
  play_youtube: PlayYoutubeArgs,
  pause_media: PauseMediaArgs,
  resume_media: ResumeMediaArgs,
  next_video: NextVideoArgs,
  add_favorite: AddFavoriteArgs,
  show_favorites: ShowFavoritesArgs,
  open_app: OpenAppArgs,
  search_waze: SearchWazeArgs,
  open_google_maps: OpenGoogleMapsArgs,
  set_theme: SetThemeArgs,
  set_visual_style: SetVisualStyleArgs,
  set_display_mode: SetDisplayModeArgs,
  request_fullscreen: RequestFullscreenArgs,
  search_radio: SearchRadioArgs,
  play_radio: PlayRadioArgs,
  search_podcasts: SearchPodcastsArgs,
  get_weather: GetWeatherArgs,
  get_vehicle_status: GetVehicleStatusArgs,
  get_playback_state: GetPlaybackStateArgs,
  open_spotify: OpenSpotifyArgs,
  spotify_control: SpotifyControlArgs,
  search_spotify: SearchSpotifyArgs,
  play_spotify: PlaySpotifyArgs,
  drive_control: DriveControlArgs,
  remember_preference: RememberPreferenceArgs,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;
export type ToolArgs<T extends ToolName> = z.infer<(typeof TOOL_SCHEMAS)[T]>;

export const DEPRECATED_TOOL_NAMES: readonly string[] = [];
