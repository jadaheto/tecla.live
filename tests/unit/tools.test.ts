import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOL_SCHEMAS } from "@/features/ai/tools/schemas";
import {
  buildDeepSeekTools,
  CLIENT_TOOL_NAMES,
  TOOL_DEFINITIONS,
} from "@/lib/ai/tools/registry";
import { ALLOWED_APP_IDS as CATALOG_APP_IDS } from "@/lib/catalog";

describe("AI tool registry", () => {
  it("defines a unique name for every tool", () => {
    const names = TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThanOrEqual(20);
  });

  it("builds valid DeepSeek JSON schemas", () => {
    const tools = buildDeepSeekTools();
    expect(tools.length).toBe(TOOL_DEFINITIONS.length);
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.parameters.type).toBe("object");
      expect(tool.function.parameters).not.toHaveProperty("$schema");
    }
  });

  it("validates play_youtube video IDs", () => {
    expect(TOOL_SCHEMAS.play_youtube.safeParse({ videoId: "dQw4w9WgXcQ" }).success).toBe(true);
    expect(TOOL_SCHEMAS.play_youtube.safeParse({ videoId: "../etc/passwd" }).success).toBe(false);
    expect(TOOL_SCHEMAS.play_youtube.safeParse({ videoId: "short" }).success).toBe(false);
  });

  it("rejects apps outside the allowlist", () => {
    expect(TOOL_SCHEMAS.open_app.safeParse({ appId: "youtube" }).success).toBe(true);
    expect(TOOL_SCHEMAS.open_app.safeParse({ appId: "shell" }).success).toBe(false);
    expect(TOOL_SCHEMAS.open_app.safeParse({ appId: "youtube", url: "https://evil.test" }).success).toBe(false);
  });

  it("rejects arbitrary URLs and extra fields in favorites", () => {
    expect(
      TOOL_SCHEMAS.add_favorite.safeParse({
        kind: "youtube",
        providerId: "abc",
        title: "Video",
        imageUrl: "https://i.ytimg.com/x.jpg",
      }).success,
    ).toBe(true);
    expect(
      TOOL_SCHEMAS.add_favorite.safeParse({
        kind: "youtube",
        providerId: "abc",
        title: "Video",
        href: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("keeps client tools out of server execution", () => {
    for (const name of CLIENT_TOOL_NAMES) {
      expect(TOOL_SCHEMAS[name]).toBeDefined();
    }
    expect(CLIENT_TOOL_NAMES.has("search_youtube")).toBe(false);
    expect(CLIENT_TOOL_NAMES.has("get_weather")).toBe(false);
    expect(CLIENT_TOOL_NAMES.has("play_youtube")).toBe(true);
  });

  it("keeps the app allowlist aligned with the catalog", () => {
    const schema = z.toJSONSchema(TOOL_SCHEMAS.open_app) as {
      properties?: { appId?: { enum?: string[] } };
    };
    expect(schema.properties?.appId?.enum).toEqual([...CATALOG_APP_IDS]);
  });

  it("validates theme and display modes", () => {
    expect(TOOL_SCHEMAS.set_theme.safeParse({ theme: "dark" }).success).toBe(true);
    expect(TOOL_SCHEMAS.set_theme.safeParse({ theme: "neon" }).success).toBe(false);
    expect(TOOL_SCHEMAS.set_display_mode.safeParse({ mode: "cinema" }).success).toBe(true);
  });
});
