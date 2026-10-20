import { z } from "zod";

export const favoriteSyncSchema = z
  .object({
    kind: z.enum(["youtube", "radio", "podcast", "channel", "iptv"]),
    providerId: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    subtitle: z.string().max(300).optional(),
    imageUrl: z.string().url().max(600).optional(),
    href: z.string().max(600).optional(),
  })
  .strict();

export const historySyncSchema = z
  .object({
    kind: z.enum(["youtube", "radio", "podcast", "channel", "iptv"]),
    providerId: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    subtitle: z.string().max(300).optional(),
    imageUrl: z.string().url().max(600).optional(),
    href: z.string().max(600).optional(),
    positionSeconds: z.number().int().min(0).max(86_400),
    durationSeconds: z.number().int().min(0).max(86_400),
    lastWatchedAt: z.string().datetime().optional(),
  })
  .strict();

export const preferencesSyncSchema = z
  .object({
    theme: z.enum(["light", "dark", "auto"]),
    displayMode: z.enum(["normal", "cinema", "kiosk"]),
    autoThemeEnabled: z.boolean(),
    autoThemeStart: z.string().regex(/^\d{2}:\d{2}$/),
    autoThemeEnd: z.string().regex(/^\d{2}:\d{2}$/),
    reduceMotion: z.boolean(),
    voiceEnabled: z.boolean(),
    conversationMode: z.boolean(),
    volume: z.number().int().min(0).max(100),
    aiVoiceId: z.string().max(60).optional(),
    weatherLocation: z.string().max(120),
    weatherLat: z.number().min(-90).max(90),
    weatherLon: z.number().min(-180).max(180),
  })
  .strict();

export const librarySyncSchema = z
  .object({
    favorites: z.array(favoriteSyncSchema).max(300).default([]),
    history: z.array(historySyncSchema).max(100).default([]),
    preferences: preferencesSyncSchema.optional(),
  })
  .strict();

export type LibrarySyncInput = z.infer<typeof librarySyncSchema>;
