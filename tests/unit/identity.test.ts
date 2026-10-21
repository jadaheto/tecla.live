import { describe, expect, it } from "vitest";
import { identityBlock, normalizeAssistantName } from "@/lib/ai/identity";
import { FALLBACK_CURATED_VOICES as CURATED_VOICES, isCuratedVoice } from "@/lib/ai/elevenlabs/curated-voices";

describe("assistant identity", () => {
  it("normalizes the custom name and falls back to TECLA", () => {
    expect(normalizeAssistantName("  Jarvis ")).toBe("Jarvis");
    expect(normalizeAssistantName("")).toBe("TECLA");
    expect(normalizeAssistantName("<script>alert(1)</script>".repeat(3)).length).toBeLessThanOrEqual(24);
    expect(normalizeAssistantName(null)).toBe("TECLA");
  });

  it("builds an identity block that names the assistant and its principles", () => {
    const block = identityBlock("Jarvis");
    expect(block).toContain("Tu nombre es «Jarvis»");
    expect(block).toContain("También respondes si te llaman «TECLA»");
    expect(block).toContain("No elude restricciones de seguridad del vehículo");
    expect(identityBlock("TECLA")).not.toContain("También respondes");
  });
});

describe("curated ElevenLabs voices", () => {
  it("has three popular male, three popular female and Latin American voices with unique ids", () => {
    expect(new Set(CURATED_VOICES.map((voice) => voice.id)).size).toBe(CURATED_VOICES.length);
    expect(CURATED_VOICES.filter((voice) => voice.group === "hombres")).toHaveLength(3);
    expect(CURATED_VOICES.filter((voice) => voice.group === "mujeres")).toHaveLength(3);
    expect(CURATED_VOICES.filter((voice) => voice.group === "latino").length).toBeGreaterThanOrEqual(3);
    for (const voice of CURATED_VOICES) expect(voice.id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(isCuratedVoice("nPczCjzI2devNBz1zQrb")).toBe(true);
    expect(isCuratedVoice("not-a-voice")).toBe(false);
  });
});

import { parseCuratedVoices, FALLBACK_CURATED_VOICES } from "@/lib/ai/elevenlabs/curated-voices";

describe("ELEVENLABS_VOICES parsing", () => {
  it("parses the env format, ignores invalid entries and duplicates", () => {
    const parsed = parseCuratedVoices(
      "cAiEyIv3FkdNcqX4j2lu|Alejandro · sereno|latino|male; bad entry ;EXAVITQu4vr4xnSDxMaL|Sarah|mujeres|female;cAiEyIv3FkdNcqX4j2lu|dup|latino|male;nPczCjzI2devNBz1zQrb|Brian|hombres",
    );
    expect(parsed).toEqual([
      { id: "cAiEyIv3FkdNcqX4j2lu", name: "Alejandro · sereno", group: "latino", gender: "male" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", group: "mujeres", gender: "female" },
      { id: "nPczCjzI2devNBz1zQrb", name: "Brian", group: "hombres", gender: "male" },
    ]);
    expect(parseCuratedVoices("")).toEqual([]);
    expect(FALLBACK_CURATED_VOICES.length).toBe(10);
  });
});

import { effectivePersona } from "@/features/ai/persona";
import { getKittVoiceId } from "@/lib/ai/elevenlabs/curated-voices";

describe("Knight Rider style", () => {
  it("activates the KITT persona over the chosen one and picks a deep male voice", () => {
    expect(effectivePersona({ aiPersona: "copiloto", visualStyle: "kitt" })).toBe("kitt");
    expect(effectivePersona({ aiPersona: "copiloto", visualStyle: "tecla" })).toBe("copiloto");
    expect(effectivePersona({ aiPersona: "jarvis", visualStyle: "cyberpunk" })).toBe("jarvis");
    delete process.env.ELEVENLABS_KITT_VOICE_ID;
    expect(getKittVoiceId()).toBe("UiSSTkQfzyt8mQUKITpS");
    process.env.ELEVENLABS_KITT_VOICE_ID = "abcdefghij1234567890";
    expect(getKittVoiceId()).toBe("abcdefghij1234567890");
    delete process.env.ELEVENLABS_KITT_VOICE_ID;
  });
});

import { parseVoicesPayload } from "@/lib/ai/elevenlabs/voices";

describe("ElevenLabs voices payload", () => {
  it("tolerates nulls and unknown fields and skips malformed entries", () => {
    const result = parseVoicesPayload({
      voices: [
        { voice_id: "a1", name: "Alpha", category: null, labels: { accent: "latin", age: null, extra: { x: 1 } }, preview_url: null, new_field: true },
        { voice_id: "b2", name: "Beta" },
        { name: "Sin id" },
        "basura",
      ],
      extra: 1,
    });
    expect(result.voices).toEqual([
      { id: "a1", name: "Alpha", category: undefined, labels: { accent: "latin" } },
      { id: "b2", name: "Beta", category: undefined, labels: undefined },
    ]);
    expect(result.skipped).toBe(2);
    expect(parseVoicesPayload({ voices: null }).voices).toEqual([]);
    expect(() => parseVoicesPayload("nope")).toThrow("ELEVENLABS_VOICES_INVALID");
  });
});
