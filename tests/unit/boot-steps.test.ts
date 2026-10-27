import { describe, expect, it } from "vitest";
import { bootDuration, bootTitles, buildBootSteps } from "@/features/boot/boot-steps";

const integrations = { deepseek: true, deepgram: true, elevenlabs: true, spotify: true, youtube: true };

describe("secuencia de arranque", () => {
  it("reports the real state of every system", () => {
    const steps = buildBootSteps({
      integrations,
      weather: { temperature: 27.4, label: "Lluvia ligera", location: "Sincelejo, Sucre, Colombia" },
      spotifyLinked: true,
      secureContext: true,
      geolocation: true,
      nowPlaying: "Radioactiva",
      wakeWord: true,
    });
    expect(steps.map((step) => step.id)).toEqual(["weather", "ai", "voice", "spotify", "youtube", "gps", "audio"]);
    expect(steps.every((step) => step.state === "ok")).toBe(true);
    expect(steps[0]?.detail).toBe("27° · Lluvia ligera · Sincelejo");
    expect(steps[2]?.detail).toContain("Oye TECLA");
    expect(steps[6]?.detail).toBe("Sonando: Radioactiva");
  });

  it("never pretends a missing integration is online", () => {
    const steps = buildBootSteps({
      integrations: { ...integrations, deepseek: false, elevenlabs: false, spotify: false, youtube: false },
      weather: null,
      spotifyLinked: null,
      secureContext: false,
      geolocation: true,
      nowPlaying: null,
      wakeWord: false,
    });
    const byId = Object.fromEntries(steps.map((step) => [step.id, step]));
    expect(byId.weather?.state).toBe("warn");
    expect(byId.ai?.state).toBe("off");
    expect(byId.voice).toMatchObject({ state: "warn", detail: "Solo reconocimiento" });
    expect(byId.spotify?.state).toBe("off");
    expect(byId.youtube?.state).toBe("off");
    expect(byId.gps).toMatchObject({ state: "warn", detail: "Requiere HTTPS" });
    expect(byId.audio?.detail).toBe("En silencio");
  });

  it("marks a configured but unlinked Spotify as a warning", () => {
    const steps = buildBootSteps({ integrations, weather: null, spotifyLinked: false, secureContext: true, geolocation: false, nowPlaying: null, wakeWord: false });
    expect(steps.find((step) => step.id === "spotify")).toMatchObject({ state: "warn", detail: "Cuenta sin vincular" });
    expect(steps.find((step) => step.id === "gps")?.state).toBe("off");
  });

  it("speaks the language of each visual style and shortens with reduced motion", () => {
    expect(bootTitles("kitt").ready).toBe("KITT en línea");
    expect(bootTitles("roadster").title).toBe("Chequeo de cabina");
    expect(bootTitles("cyberpunk").eyebrow).toBe("Night City OS");
    expect(bootTitles("tecla").title).toBe("Iniciando sistemas");
    expect(bootDuration(7, false).totalMs).toBeGreaterThan(bootDuration(7, true).totalMs);
    expect(bootDuration(7, true).totalMs).toBeLessThan(1_600);
  });
});
