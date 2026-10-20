import { describe, expect, it } from "vitest";
import { librarySyncSchema, preferencesSyncSchema } from "@/lib/validation/library";

const preferences = {
  theme: "dark" as const,
  displayMode: "normal" as const,
  autoThemeEnabled: true,
  autoThemeStart: "18:30",
  autoThemeEnd: "06:30",
  reduceMotion: false,
  voiceEnabled: true,
  conversationMode: false,
  volume: 80,
  weatherLocation: "Sincelejo, Sucre, Colombia",
  weatherLat: 9.3047,
  weatherLon: -75.3978,
};

describe("library sync validation", () => {
  it("accepts a valid payload", () => {
    const parsed = librarySyncSchema.safeParse({
      favorites: [
        {
          kind: "youtube",
          providerId: "dQw4w9WgXcQ",
          title: "Un video",
          subtitle: "Un canal",
          imageUrl: "https://i.ytimg.com/vi/x/hqdefault.jpg",
        },
      ],
      history: [],
      preferences,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects extra fields and invalid providers", () => {
    expect(
      librarySyncSchema.safeParse({
        favorites: [
          { kind: "youtube", providerId: "x", title: "x", evil: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      librarySyncSchema.safeParse({
        favorites: [{ kind: "shell", providerId: "x", title: "x" }],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid preferences and volumes", () => {
    expect(preferencesSyncSchema.safeParse({ ...preferences, volume: 101 }).success).toBe(false);
    expect(preferencesSyncSchema.safeParse({ ...preferences, autoThemeStart: "8:00" }).success).toBe(false);
    expect(preferencesSyncSchema.safeParse({ ...preferences, theme: "neon" }).success).toBe(false);
    expect(preferencesSyncSchema.safeParse({ ...preferences, weatherLat: 100 }).success).toBe(false);
  });

  it("limits history positions to a day", () => {
    expect(
      librarySyncSchema.safeParse({
        history: [
          {
            kind: "podcast",
            providerId: "1",
            title: "Episodio",
            positionSeconds: 90_000,
            durationSeconds: 100,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
