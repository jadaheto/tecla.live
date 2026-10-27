import { z } from "zod";

/**
 * Contrato del control remoto por celular. El auto (TECLA en el Tesla) abre
 * una sala; el celular, al escanear el QR, envía órdenes acotadas a esta
 * lista. Nunca se aceptan URLs ni texto ejecutable: solo acciones conocidas.
 */
export const REMOTE_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
export const REMOTE_TOKEN = /^[a-f0-9]{48}$/;

/** Pantallas internas que el celular puede abrir (sin enlaces externos). */
export const REMOTE_SCREENS = ["home", "youtube", "music", "radio", "podcasts", "navigate", "drive", "tesla", "chargers", "settings"] as const;
export type RemoteScreen = (typeof REMOTE_SCREENS)[number];

export const RemoteCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play") }).strict(),
  z.object({ type: z.literal("pause") }).strict(),
  z.object({ type: z.literal("next") }).strict(),
  z.object({ type: z.literal("volume"), delta: z.number().int().min(-50).max(50) }).strict(),
  z.object({ type: z.literal("open"), screen: z.enum(REMOTE_SCREENS) }).strict(),
  z.object({ type: z.literal("ambient"), on: z.boolean() }).strict(),
  z.object({ type: z.literal("ask"), text: z.string().trim().min(1).max(240) }).strict(),
  z.object({ type: z.literal("style"), style: z.enum(["tecla", "cyberpunk", "kitt", "roadster", "discovery"]) }).strict(),
]);
export type RemoteCommand = z.infer<typeof RemoteCommandSchema>;

export const RemoteStateSchema = z
  .object({
    screen: z.string().trim().max(40),
    title: z.string().trim().max(160).nullable(),
    subtitle: z.string().trim().max(160).nullable(),
    kind: z.string().trim().max(20).nullable(),
    isPlaying: z.boolean(),
    volume: z.number().int().min(0).max(100),
    style: z.enum(["tecla", "cyberpunk", "kitt", "roadster", "discovery"]),
    ambient: z.boolean(),
  })
  .strict();
export type RemoteState = z.infer<typeof RemoteStateSchema>;

export const RemoteSessionRequestSchema = z
  .object({
    code: z.string().regex(REMOTE_CODE).optional(),
    token: z.string().regex(REMOTE_TOKEN).optional(),
  })
  .strict();

export interface RemoteSessionResponse {
  code: string;
  token: string;
  expiresAt: string;
}

export interface RemotePublicRoom {
  alive: boolean;
  carConnected: boolean;
  state: RemoteState | null;
  updatedAt: string | null;
}
