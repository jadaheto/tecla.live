// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => ({ data: { integrations: { deepseek: true, deepgram: true, elevenlabs: true } }, isLoading: false }),
}));

import { WakeWordListener } from "@/components/ai/wake-word-listener";
import { matchesWakeWord, normalizeSpeech } from "@/features/ai/wake-word";
import { useAi } from "@/features/ai/store";
import { usePreferences } from "@/stores/preferences";

type FakeResult = { isFinal: boolean; length?: number; [index: number]: { transcript: string } | undefined };

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: FakeResult[] }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  started = 0;
  aborted = 0;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started += 1;
    this.onstart?.();
  }
  stop() {}
  abort() {
    this.aborted += 1;
    this.onend?.();
  }
  hear(...alternatives: string[]) {
    const result: FakeResult = { isFinal: false, length: alternatives.length };
    alternatives.forEach((transcript, index) => {
      result[index] = { transcript };
    });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

describe("wake word matcher", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalizeSpeech("¡Oye, TECLA!")).toBe("oye tecla");
  });

  it("accepts the phrase, its phonetic variants and a one-letter error", () => {
    expect(matchesWakeWord("oye tecla pon música")).toBe(true);
    expect(matchesWakeWord("Hey Tecla")).toBe(true);
    expect(matchesWakeWord("hola tesla, qué clima hace")).toBe(true);
    expect(matchesWakeWord("oye te cla")).toBe(true);
    expect(matchesWakeWord("olle tekla")).toBe(true);
    expect(matchesWakeWord("oyetecla")).toBe(true);
    expect(matchesWakeWord("hoye tecla")).toBe(true);
  });

  it("ignores ordinary speech and radio chatter", () => {
    expect(matchesWakeWord("pon música de coldplay")).toBe(false);
    expect(matchesWakeWord("la tecla de enter no funciona")).toBe(false);
    expect(matchesWakeWord("hoy es un gran día")).toBe(false);
    expect(matchesWakeWord("")).toBe(false);
  });

  it("responds to a custom name and to KITT only in the Knight Rider style", () => {
    expect(matchesWakeWord("oye jarvis", { assistantName: "Jarvis" })).toBe(true);
    expect(matchesWakeWord("oye kitt", {})).toBe(false);
    expect(matchesWakeWord("oye kitt", { style: "kitt" })).toBe(true);
    expect(matchesWakeWord("hola kit, enciende la radio", { style: "kitt" })).toBe(true);
  });
});

describe("«Oye TECLA» wake word", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    FakeRecognition.instances = [];
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    usePreferences.setState({ wakeWordEnabled: true, micConsent: true, aiAutoListen: true, visualStyle: "tecla", aiName: "TECLA" });
    useAi.setState({ voiceOpen: false, panelOpen: false, status: "idle" });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("starts listening, ignores other speech, and opens the voice HUD on the phrase", () => {
    act(() => {
      root.render(<WakeWordListener />);
    });
    const recognition = FakeRecognition.instances[0];
    expect(recognition).toBeDefined();
    expect(recognition?.started).toBe(1);
    expect(recognition?.continuous).toBe(true);
    expect(recognition?.maxAlternatives).toBe(3);
    expect(host.textContent).toContain("escuchando");

    act(() => recognition?.hear("pon música de coldplay"));
    expect(useAi.getState().voiceOpen).toBe(false);

    // La frase aparece solo en la segunda alternativa del reconocedor.
    act(() => recognition?.hear("olla tela pon música", "oye tecla pon música"));
    expect(useAi.getState().voiceOpen).toBe(true);
    expect(recognition?.aborted).toBeGreaterThanOrEqual(1);
  });

  it("restarts after the recognizer ends and pauses while TECLA AI is open", () => {
    vi.useFakeTimers();
    act(() => {
      root.render(<WakeWordListener />);
    });
    const first = FakeRecognition.instances[0];
    act(() => first?.onend?.());
    expect(host.textContent).toContain("en pausa");
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(FakeRecognition.instances.length).toBe(2);
    expect(host.textContent).toContain("escuchando");

    act(() => useAi.setState({ panelOpen: true }));
    expect(FakeRecognition.instances[1]?.aborted).toBe(1);
    vi.useRealTimers();
  });

  it("backs off after repeated network errors and recovers on the next result", () => {
    vi.useFakeTimers();
    act(() => {
      root.render(<WakeWordListener />);
    });
    const first = FakeRecognition.instances[0];
    act(() => {
      first?.onerror?.({ error: "network" });
      first?.onend?.();
    });
    expect(host.textContent).toContain("reconectando");
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // Con un error acumulado la espera es mayor que el reinicio normal.
    expect(FakeRecognition.instances.length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(FakeRecognition.instances.length).toBe(2);
    const second = FakeRecognition.instances[1];
    act(() => {
      second?.onerror?.({ error: "network" });
      second?.onend?.();
      vi.advanceTimersByTime(3_000);
    });
    const third = FakeRecognition.instances[2];
    act(() => {
      third?.onerror?.({ error: "network" });
    });
    expect(host.textContent).toContain("sin servicio de voz");
    act(() => third?.hear("hola, buenos días"));
    expect(host.textContent).toContain("escuchando");
    vi.useRealTimers();
  });

  it("offers a tap to re-enable when the microphone permission was denied", () => {
    act(() => {
      root.render(<WakeWordListener />);
    });
    const first = FakeRecognition.instances[0];
    act(() => first?.onerror?.({ error: "not-allowed" }));
    const button = host.querySelector("button");
    expect(button?.textContent).toContain("Toca para activar");
  });
});
