// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/integrations/hooks", () => ({
  useIntegrations: () => ({ data: { integrations: { deepseek: true, deepgram: true, elevenlabs: true } }, isLoading: false }),
}));

import { WakeWordListener } from "@/components/ai/wake-word-listener";
import { useAi } from "@/features/ai/store";
import { usePreferences } from "@/stores/preferences";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  started = 0;
  aborted = 0;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started += 1;
  }
  stop() {}
  abort() {
    this.aborted += 1;
    this.onend?.();
  }
  hear(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript } }] });
  }
}

describe("«Oye TECLA» wake word", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    FakeRecognition.instances = [];
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    usePreferences.setState({ wakeWordEnabled: true, micConsent: true, aiAutoListen: true });
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
    expect(host.textContent).toContain("escuchando");

    act(() => recognition?.hear("pon música de coldplay"));
    expect(useAi.getState().voiceOpen).toBe(false);

    act(() => recognition?.hear("oye tecla pon música"));
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
});
