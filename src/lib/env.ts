const trim = (value: string | undefined): string => value?.trim() ?? "";

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function floatFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const serverConfig = {
  appUrl: trim(process.env.APP_URL) || "http://localhost:3000",
  databaseUrl: trim(process.env.DATABASE_URL),
  authSecret: trim(process.env.AUTH_SECRET),
  tokenEncryptionKey: trim(process.env.TOKEN_ENCRYPTION_KEY),
  youtubeApiKey: trim(process.env.YOUTUBE_API_KEY),
  spotifyClientId: trim(process.env.SPOTIFY_CLIENT_ID),
  spotifyClientSecret: trim(process.env.SPOTIFY_CLIENT_SECRET),
  spotifyRedirectUri:
    trim(process.env.SPOTIFY_REDIRECT_URI) ||
    `${trim(process.env.APP_URL) || "http://localhost:3000"}/api/spotify/callback`,
  deepseekApiKey: trim(process.env.DEEPSEEK_API_KEY),
  deepseekBaseUrl: trim(process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com",
  deepseekModel: trim(process.env.DEEPSEEK_MODEL) || "deepseek-chat",
  deepgramApiKey: trim(process.env.DEEPGRAM_API_KEY),
  deepgramModel: trim(process.env.DEEPGRAM_MODEL) || "nova-3",
  elevenLabsApiKey: trim(process.env.ELEVENLABS_API_KEY),
  elevenLabsVoiceId: trim(process.env.ELEVENLABS_VOICE_ID),
  elevenLabsModelId: trim(process.env.ELEVENLABS_MODEL_ID) || "eleven_flash_v2_5",
  // Tesla Fleet API: la app se registra con un dominio sin «tesla» ni parecidos (sinapsia.co);
  // TECLA sigue en tecla.live y ese dominio solo aloja la llave pública y el reenvío del callback.
  teslaClientId: trim(process.env.TESLA_CLIENT_ID),
  teslaClientSecret: trim(process.env.TESLA_CLIENT_SECRET),
  teslaDomain: trim(process.env.TESLA_DOMAIN) || "sinapsia.co",
  teslaRedirectUri:
    trim(process.env.TESLA_REDIRECT_URI) || `https://${trim(process.env.TESLA_DOMAIN) || "sinapsia.co"}/tesla/callback.php`,
  teslaRegion: (trim(process.env.TESLA_REGION).toLowerCase() === "eu" ? "eu" : "na") as "na" | "eu",
  teslaScopes: trim(process.env.TESLA_SCOPES),
  limits: {
    maxInputTokens: intFromEnv("AI_MAX_INPUT_TOKENS", 6000, 500, 128_000),
    maxOutputTokens: intFromEnv("AI_MAX_OUTPUT_TOKENS", 700, 100, 8192),
    maxToolSteps: intFromEnv("AI_MAX_TOOL_STEPS", 4, 1, 8),
    monthlyBudgetUsd: floatFromEnv("AI_MONTHLY_BUDGET_USD", 10, 0, 10_000),
    guestRateLimit: intFromEnv("AI_GUEST_RATE_LIMIT", 12, 1, 120),
    chatRateLimit: intFromEnv("AI_CHAT_RATE_LIMIT", 20, 1, 120),
    ttsRateLimit: intFromEnv("AI_TTS_RATE_LIMIT", 20, 1, 120),
    sttRateLimit: intFromEnv("AI_STT_RATE_LIMIT", 20, 1, 120),
    maxTtsChars: intFromEnv("AI_MAX_TTS_CHARS", 900, 50, 5000),
    maxAudioSeconds: intFromEnv("AI_MAX_AUDIO_SECONDS", 45, 5, 120),
  },
} as const;

export type IntegrationKey =
  | "youtube"
  | "deepseek"
  | "deepgram"
  | "elevenlabs"
  | "spotify"
  | "tesla"
  | "database"
  | "auth";

export const integrationStatus: Record<IntegrationKey, boolean> = {
  youtube: Boolean(serverConfig.youtubeApiKey),
  deepseek: Boolean(serverConfig.deepseekApiKey),
  deepgram: Boolean(serverConfig.deepgramApiKey),
  elevenlabs: Boolean(serverConfig.elevenLabsApiKey && serverConfig.elevenLabsVoiceId),
  spotify: Boolean(
    serverConfig.spotifyClientId &&
      serverConfig.spotifyClientSecret &&
      serverConfig.tokenEncryptionKey &&
      serverConfig.databaseUrl,
  ),
  tesla: Boolean(
    serverConfig.teslaClientId && serverConfig.teslaClientSecret && serverConfig.tokenEncryptionKey && serverConfig.databaseUrl,
  ),
  database: Boolean(serverConfig.databaseUrl),
  auth: Boolean(serverConfig.databaseUrl && serverConfig.authSecret),
};

export function requireSpotifyEncryption(): boolean {
  return Boolean(serverConfig.tokenEncryptionKey) && integrationStatus.spotify;
}
