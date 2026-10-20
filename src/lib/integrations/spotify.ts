import { z } from "zod";
import { serverConfig } from "@/lib/env";
import { prisma, isDatabaseConfigured } from "@/lib/db/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { logger } from "@/lib/logger";

export const SPOTIFY_PROVIDER = "spotify";
export const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
].join(" ");

export class SpotifyError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "SpotifyError";
    this.code = code;
    this.status = status;
  }
}

export function spotifyConfigured(): boolean {
  return Boolean(serverConfig.spotifyClientId && serverConfig.spotifyClientSecret);
}

export function spotifyEncryptionConfigured(): boolean {
  return Boolean(serverConfig.tokenEncryptionKey) && isDatabaseConfigured();
}

export function buildSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: serverConfig.spotifyClientId,
    response_type: "code",
    redirect_uri: serverConfig.spotifyRedirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "false",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function basicAuth(): string {
  return Buffer.from(
    `${serverConfig.spotifyClientId}:${serverConfig.spotifyClientSecret}`,
  ).toString("base64");
}

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
});

const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable().optional(),
  email: z.string().optional(),
  product: z.string().optional(),
});

async function requestToken(body: URLSearchParams): Promise<z.infer<typeof TokenResponseSchema>> {
  let response: Response;
  try {
    response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new SpotifyError(
      "SPOTIFY_UNREACHABLE",
      "No pudimos conectar con Spotify. Intenta de nuevo.",
      503,
    );
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new SpotifyError(
        "SPOTIFY_REAUTH_REQUIRED",
        "La autorización de Spotify expiró. Vuelve a conectar tu cuenta.",
        401,
      );
    }
    throw new SpotifyError(
      "SPOTIFY_AUTH_ERROR",
      "Spotify rechazó la autorización.",
      502,
    );
  }

  const parsed = TokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SpotifyError("SPOTIFY_INVALID_RESPONSE", "Spotify devolvió una respuesta inesperada.", 502);
  }
  return parsed.data;
}

export async function saveSpotifyAccount(input: {
  userId: string;
  code: string;
}): Promise<void> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: serverConfig.spotifyRedirectUri,
    }),
  );

  const me = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!me.ok) {
    throw new SpotifyError(
      "SPOTIFY_PROFILE_UNAVAILABLE",
      "No pudimos leer el perfil de Spotify.",
      502,
    );
  }
  const profile = ProfileSchema.safeParse(await me.json());
  if (!profile.success) {
    throw new SpotifyError("SPOTIFY_PROFILE_UNAVAILABLE", "Perfil de Spotify inválido.", 502);
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.connectedAccount.upsert({
    where: { userId_provider: { userId: input.userId, provider: SPOTIFY_PROVIDER } },
    create: {
      userId: input.userId,
      provider: SPOTIFY_PROVIDER,
      providerAccountId: profile.data.id,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
      scope: tokens.scope ?? SPOTIFY_SCOPES,
    },
    update: {
      providerAccountId: profile.data.id,
      accessToken: encryptToken(tokens.access_token),
      ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
      expiresAt,
      scope: tokens.scope ?? SPOTIFY_SCOPES,
    },
  });

  logger.info("spotify.account_connected", { userId: input.userId });
}

export async function getSpotifyAccessToken(userId: string): Promise<string> {
  if (!spotifyConfigured()) {
    throw new SpotifyError("SPOTIFY_NOT_CONFIGURED", "Spotify no está configurado.", 503);
  }
  if (!spotifyEncryptionConfigured()) {
    throw new SpotifyError(
      "SPOTIFY_ENCRYPTION_NOT_CONFIGURED",
      "Falta TOKEN_ENCRYPTION_KEY o la base de datos para conectar Spotify.",
      503,
    );
  }

  const account = await prisma.connectedAccount.findUnique({
    where: { userId_provider: { userId, provider: SPOTIFY_PROVIDER } },
  });
  if (!account) {
    throw new SpotifyError(
      "SPOTIFY_NOT_CONNECTED",
      "Tu cuenta de Spotify no está conectada. Abre Música y vincula Spotify.",
      401,
    );
  }

  const expiresSoon =
    account.expiresAt !== null && account.expiresAt.getTime() < Date.now() + 60_000;

  if (!expiresSoon) {
    try {
      return decryptToken(account.accessToken);
    } catch {
      throw new SpotifyError(
        "SPOTIFY_TOKEN_INVALID",
        "No pudimos leer el token de Spotify. Vuelve a conectar tu cuenta.",
        401,
      );
    }
  }

  if (!account.refreshToken) {
    throw new SpotifyError(
      "SPOTIFY_REAUTH_REQUIRED",
      "La sesión de Spotify expiró. Vuelve a conectar tu cuenta.",
      401,
    );
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(account.refreshToken);
  } catch {
    throw new SpotifyError(
      "SPOTIFY_REAUTH_REQUIRED",
      "No pudimos renovar Spotify. Vuelve a conectar tu cuenta.",
      401,
    );
  }

  const refreshed = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );

  const expiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000)
    : null;

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encryptToken(refreshed.access_token),
      ...(refreshed.refresh_token
        ? { refreshToken: encryptToken(refreshed.refresh_token) }
        : {}),
      expiresAt,
    },
  });

  return refreshed.access_token;
}

async function spotifyFetch(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getSpotifyAccessToken(userId);
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new SpotifyError(
      "SPOTIFY_REAUTH_REQUIRED",
      "La autorización de Spotify expiró. Vuelve a conectar tu cuenta.",
      401,
    );
  }
  if (response.status === 403) {
    throw new SpotifyError(
      "SPOTIFY_PREMIUM_REQUIRED",
      "Spotify requiere una cuenta Premium o permisos adicionales para esta acción.",
      403,
    );
  }
  if (response.status === 429) {
    throw new SpotifyError(
      "SPOTIFY_RATE_LIMITED",
      "Spotify está limitando solicitudes. Espera unos segundos.",
      429,
    );
  }
  return response;
}

const NowPlayingSchema = z.object({
  is_playing: z.boolean().optional().default(false),
  progress_ms: z.number().nullable().optional(),
  currently_playing_type: z.string().optional(),
  device: z
    .object({
      id: z.string().nullable().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      volume_percent: z.number().nullable().optional(),
      is_active: z.boolean().optional(),
    })
    .optional(),
  item: z
    .object({
      id: z.string(),
      name: z.string(),
      duration_ms: z.number().optional(),
      external_urls: z.object({ spotify: z.string().optional() }).optional(),
      artists: z.array(z.object({ name: z.string() })).optional(),
      album: z
        .object({
          name: z.string().optional(),
          images: z.array(z.object({ url: z.string(), width: z.number().optional(), height: z.number().optional() })).optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});

export interface SpotifyNowPlaying {
  playing: boolean;
  progressMs: number;
  durationMs: number;
  track: {
    id: string;
    name: string;
    artists: string[];
    album: string | null;
    imageUrl: string | null;
    externalUrl: string | null;
  } | null;
  device: string | null;
  deviceVolume: number | null;
}

export async function getSpotifyNowPlaying(userId: string): Promise<SpotifyNowPlaying> {
  const response = await spotifyFetch(userId, "/me/player");
  if (response.status === 204) {
    return {
      playing: false,
      progressMs: 0,
      durationMs: 0,
      track: null,
      device: null,
      deviceVolume: null,
    };
  }
  if (!response.ok) {
    if (response.status === 404) {
      return {
        playing: false,
        progressMs: 0,
        durationMs: 0,
        track: null,
        device: null,
        deviceVolume: null,
      };
    }
    throw new SpotifyError("SPOTIFY_STATE_UNAVAILABLE", "No pudimos leer el estado de Spotify.", 502);
  }

  const parsed = NowPlayingSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SpotifyError("SPOTIFY_INVALID_STATE", "Spotify devolvió un estado inesperado.", 502);
  }
  const data = parsed.data;
  const image = data.item?.album?.images?.[0]?.url ?? null;
  return {
    playing: data.is_playing ?? false,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item?.duration_ms ?? 0,
    track: data.item
      ? {
          id: data.item.id,
          name: data.item.name,
          artists: (data.item.artists ?? []).map((artist) => artist.name),
          album: data.item.album?.name ?? null,
          imageUrl: image,
          externalUrl: data.item.external_urls?.spotify ?? null,
        }
      : null,
    device: data.device?.name ?? null,
    deviceVolume: data.device?.volume_percent ?? null,
  };
}

async function findDeviceId(userId: string): Promise<string | null> {
  const response = await spotifyFetch(userId, "/me/player/devices");
  if (!response.ok) return null;
  const parsed = z
    .object({
      devices: z
        .array(
          z.object({
            id: z.string().nullable().optional(),
            is_active: z.boolean().optional(),
            name: z.string().optional(),
          }),
        )
        .optional()
        .default([]),
    })
    .safeParse(await response.json());
  if (!parsed.success) return null;
  const active = parsed.data.devices.find((device) => device.is_active && device.id);
  const fallback = parsed.data.devices.find((device) => device.id);
  return active?.id ?? fallback?.id ?? null;
}

export type SpotifyAction = "play" | "pause" | "next" | "previous" | "volume";

export async function controlSpotify(
  userId: string,
  action: SpotifyAction,
  volume?: number,
): Promise<{ action: SpotifyAction; deviceId: string | null }> {
  const deviceId = await findDeviceId(userId);
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  let path: string;
  let method = "POST";

  switch (action) {
    case "play":
      path = `/me/player/play${query}`;
      method = "PUT";
      break;
    case "pause":
      path = `/me/player/pause${query}`;
      method = "PUT";
      break;
    case "next":
      path = `/me/player/next${query}`;
      break;
    case "previous":
      path = `/me/player/previous${query}`;
      break;
    case "volume": {
      if (volume === undefined || !Number.isFinite(volume)) {
        throw new SpotifyError("SPOTIFY_VOLUME_REQUIRED", "Falta el volumen para esta acción.", 400);
      }
      const clamped = Math.min(100, Math.max(0, Math.round(volume)));
      path = `/me/player/volume?volume_percent=${clamped}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""}`;
      method = "PUT";
      break;
    }
    default:
      throw new SpotifyError("SPOTIFY_ACTION_INVALID", "Acción de Spotify no válida.", 400);
  }

  const response = await spotifyFetch(userId, path, { method });
  if (response.status === 404) {
    throw new SpotifyError(
      "SPOTIFY_NO_ACTIVE_DEVICE",
      "No hay un dispositivo activo de Spotify. Abre Spotify en el teléfono, la computadora o el Tesla y vuelve a intentar.",
      409,
    );
  }
  if (!response.ok) {
    throw new SpotifyError(
      "SPOTIFY_CONTROL_FAILED",
      "Spotify no pudo ejecutar la acción. Verifica que haya un dispositivo activo y una cuenta Premium.",
      502,
    );
  }

  return { action, deviceId };
}

export async function disconnectSpotify(userId: string): Promise<void> {
  await prisma.connectedAccount.deleteMany({
    where: { userId, provider: SPOTIFY_PROVIDER },
  });
}
