"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAi } from "@/features/ai/store";
import { useTeclaActions } from "@/features/ai/hooks/use-tecla-actions";
import { apiFetch, errorMessage } from "@/lib/http";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { useAiMemory } from "@/stores/ai-memory";
import { useIntegrations } from "@/features/integrations/hooks";
import { getMediaController } from "@/features/media/player-bridge";
import type {
  AiChatResponse,
  AiToolExchange,
  AiToolResult,
} from "@/features/ai/types";
import type { AiVisualState } from "@/types";

const MAX_ROUNDS = 5;

const SCREEN_LABELS: Array<[string, string]> = [
  ["/watch/", "Reproductor de YouTube"],
  ["/youtube", "Videos de YouTube"],
  ["/music", "Música y Spotify"],
  ["/radio", "Radio en vivo"],
  ["/podcasts", "Podcasts"],
  ["/iptv", "IPTV"],
  ["/twitch", "Twitch"],
  ["/navigate", "Navegación y mapas"],
  ["/favorites", "Favoritos y biblioteca"],
  ["/settings", "Ajustes"],
  ["/apps", "Aplicaciones"],
  ["/ai", "TECLA AI"],
  ["/", "Inicio"],
];

function screenLabel(pathname: string): string {
  return (
    SCREEN_LABELS.find(([prefix]) =>
      prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
    )?.[1] ?? "TECLA LIVE"
  );
}

function isBusyStatus(status: AiVisualState): boolean {
  return (
    status === "thinking" ||
    status === "executing" ||
    status === "listening" ||
    status === "transcribing" ||
    status === "speaking"
  );
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useTeclaAI() {
  const pathname = usePathname();
  const executeActions = useTeclaActions();
  const capabilities = useCapabilities();
  const integrations = useIntegrations();
  const messages = useAi((state) => state.messages);
  const status = useAi((state) => state.status);
  const error = useAi((state) => state.error);
  const panelOpen = useAi((state) => state.panelOpen);

  const abortRef = React.useRef<AbortController | null>(null);
  const runIdRef = React.useRef(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const discardRef = React.useRef(false);
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const resumeAfterSpeakRef = React.useRef(false);
  const autoListenRef = React.useRef(false);
  const startListeningRef = React.useRef<() => Promise<void>>(async () => {});
  const ttsConfiguredRef = React.useRef(false);
  const elevenLabsAvailable = integrations.data?.integrations.elevenlabs ?? false;
  const deepgramAvailable = integrations.data?.integrations.deepgram ?? false;
  const maxAudioSeconds = integrations.data?.limits.maxAudioSeconds ?? 45;

  React.useEffect(() => {
    ttsConfiguredRef.current = elevenLabsAvailable;
  }, [elevenLabsAvailable]);

  const cleanupAudio = React.useCallback((restoreMedia: boolean) => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (restoreMedia && resumeAfterSpeakRef.current) {
      resumeAfterSpeakRef.current = false;
      void getMediaController()?.play().catch(() => undefined);
    }
  }, []);

  const stopPlayback = React.useCallback(() => {
    resumeAfterSpeakRef.current = false;
    autoListenRef.current = false;
    cleanupAudio(false);
  }, [cleanupAudio]);

  const speak = React.useCallback(
    async (text: string): Promise<void> => {
      const clean = text.trim();
      if (!clean || !usePreferences.getState().voiceEnabled || !ttsConfiguredRef.current) return;

      cleanupAudio(false);
      autoListenRef.current = false;
      const controller = new AbortController();
      ttsAbortRef.current = controller;
      useAi.getState().setStatus("speaking");
      useAi.getState().setError(null);

      const media = getMediaController();
      if (media?.getSnapshot().isPlaying) {
        const paused = await media.pause();
        resumeAfterSpeakRef.current = paused.ok;
      }

      try {
        const response = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: clean,
            ...(usePreferences.getState().aiVoiceId
              ? { voiceId: usePreferences.getState().aiVoiceId }
              : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = "No pudimos generar la voz. La respuesta está disponible en texto.";
          try {
            const payload = (await response.json()) as {
              error?: { message?: string };
            };
            if (payload.error?.message) message = payload.error.message;
          } catch {
            // respuesta no JSON
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        if (!blob.size) throw new Error("La voz llegó vacía. La respuesta está en texto.");
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audio.volume = Math.min(1, Math.max(0, usePreferences.getState().volume / 100));
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("El navegador no pudo reproducir el audio."));
          audio.play().catch(() =>
            reject(
              new Error(
                "El navegador bloqueó el audio. Toca el altavoz del mensaje para escucharlo.",
              ),
            ),
          );
        });

        if (controller.signal.aborted) return;
        useAi.getState().setStatus("idle");
        cleanupAudio(true);
        if (usePreferences.getState().conversationMode && useAi.getState().panelOpen) {
          autoListenRef.current = true;
          window.setTimeout(() => {
            if (autoListenRef.current) void startListeningRef.current();
          }, 350);
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        useAi.getState().setError(errorMessage(caught));
        useAi.getState().setStatus("idle");
        cleanupAudio(true);
      }
    },
    [cleanupAudio],
  );

  const send = React.useCallback(
    async (raw: string, options?: { speak?: boolean }) => {
      const text = raw.trim().slice(0, 2000);
      if (!text) return;

      const currentStatus = useAi.getState().status;
      if (currentStatus === "speaking") stopPlayback();
      else if (isBusyStatus(currentStatus)) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      const store = useAi.getState();
      store.setError(null);
      store.addMessage({ role: "user", content: text });
      store.setStatus("thinking");

      const player = usePlayer.getState();
      const context = {
        pathname,
        screen: screenLabel(pathname),
        selectedTitle: player.current?.title,
        selectedKind: player.current?.kind,
        player: player.current
          ? {
              kind: player.current.kind,
              title: player.current.title,
              isPlaying: player.isPlaying,
              positionSeconds: 0,
              durationSeconds: player.current.durationSeconds ?? 0,
            }
          : undefined,
        capabilities: {
          microphone: capabilities.microphone && capabilities.mediaRecorder,
          fullscreen: capabilities.fullscreen,
          webSpeech: capabilities.webSpeech,
        },
        ...(usePreferences.getState().memoryConsent
          ? {
              memory: useAiMemory
                .getState()
                .entries.slice(0, 12)
                .map((entry) => ({ key: entry.key, value: entry.value })),
            }
          : {}),
      };

      let toolExchange: AiToolExchange | undefined;
      const actionSummaries: NonNullable<(typeof store.messages)[number]["actions"]> = [];

      try {
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          if (runIdRef.current !== runId) return;

          const history = useAi
            .getState()
            .messages.slice(-12)
            .map((message) => ({ role: message.role, content: message.content }));

          const response = await apiFetch<AiChatResponse>("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history,
              context,
              ...(toolExchange ? { toolExchange } : {}),
            }),
            signal: controller.signal,
          });

          if (runIdRef.current !== runId) return;

          if (response.pendingActions.length === 0) {
            const finalContent = response.content || "Listo.";
            useAi.getState().addMessage({
              role: "assistant",
              content: finalContent,
              actions: actionSummaries.length > 0 ? actionSummaries : undefined,
            });
            useAi.getState().setStatus("idle");
            if (options?.speak && ttsConfiguredRef.current) {
              await speak(finalContent);
            }
            return;
          }

          useAi.getState().setStatus("executing");
          const executions = await executeActions(response.pendingActions);
          if (runIdRef.current !== runId) return;

          for (const execution of executions) {
            actionSummaries.push({
              name: execution.name,
              status: execution.ok ? "ok" : "error",
              summary: execution.summary,
            });
          }

          const serverResults = response.toolExchange?.toolResults ?? [];
          const clientResults: AiToolResult[] = executions.map((execution) => ({
            toolCallId: execution.toolCallId,
            name: execution.name,
            ok: execution.ok,
            content: execution.content,
          }));
          const merged = [...serverResults];
          for (const result of clientResults) {
            if (!merged.some((item) => item.toolCallId === result.toolCallId)) {
              merged.push(result);
            }
          }

          if (!response.toolExchange?.assistantToolCalls.length) {
            throw new Error("TECLA AI no devolvió las acciones ejecutables. Intenta de nuevo.");
          }

          toolExchange = {
            assistantContent: response.toolExchange.assistantContent ?? response.content,
            assistantToolCalls: response.toolExchange.assistantToolCalls,
            toolResults: merged,
          };
          useAi.getState().setStatus("thinking");
        }

        throw new Error(
          "La solicitud necesitó demasiados pasos. Intenta pedir una acción más concreta.",
        );
      } catch (caught) {
        if (controller.signal.aborted || runIdRef.current !== runId) return;
        autoListenRef.current = false;
        useAi.getState().setError(errorMessage(caught));
        useAi.getState().setStatus("error");
      }
    },
    [capabilities, executeActions, pathname, speak, stopPlayback],
  );

  const stopListening = React.useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    try {
      recorder.stop();
    } catch {
      // El grabador ya pudo detenerse.
    }
  }, []);

  const startListening = React.useCallback(async () => {
    const current = useAi.getState().status;
    if (current === "listening" || current === "transcribing") return;
    if (current === "thinking" || current === "executing") return;
    if (current === "speaking") stopPlayback();

    if (integrations.data && !deepgramAvailable) {
      useAi.getState().setError(
        "La voz no está configurada. Añade DEEPGRAM_API_KEY o escribe tu orden.",
      );
      return;
    }
    if (!capabilities.microphone || !capabilities.mediaRecorder) {
      useAi.getState().setError(
        "Este navegador no ofrece micrófono compatible. Puedes escribir tu orden.",
      );
      return;
    }

    if (recorderRef.current?.state === "recording") return;
    autoListenRef.current = false;
    useAi.getState().setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      useAi.getState().setError(
        name === "NotAllowedError"
          ? "El micrófono está bloqueado. Permite el acceso en el navegador o escribe tu orden."
          : name === "NotFoundError"
            ? "No encontramos un micrófono disponible. Puedes escribir tu orden."
            : "No pudimos abrir el micrófono. Puedes escribir tu orden.",
      );
      useAi.getState().setStatus("idle");
      return;
    }

    streamRef.current = stream;
    usePreferences.getState().setPreferences({ micConsent: true });
    discardRef.current = false;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      useAi.getState().setError(
        "No pudimos iniciar la grabación. Puedes escribir tu orden.",
      );
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const recordedType = recorder.mimeType || mimeType || "audio/webm";
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;

      if (discardRef.current) {
        discardRef.current = false;
        chunksRef.current = [];
        useAi.getState().setStatus("idle");
        return;
      }

      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (chunks.length === 0) {
        useAi.getState().setStatus("idle");
        useAi.getState().setError("No se capturó audio. Intenta de nuevo o escribe.");
        return;
      }
      const blob = new Blob(chunks, { type: recordedType });
      if (blob.size < 1000) {
        useAi.getState().setStatus("idle");
        useAi.getState().setError("La grabación fue muy corta. Intenta de nuevo.");
        return;
      }

      useAi.getState().setStatus("transcribing");
      const form = new FormData();
      const extension = recordedType.includes("mp4")
        ? "mp4"
        : recordedType.includes("ogg")
          ? "ogg"
          : "webm";
      form.append("audio", blob, `tecla-voice.${extension}`);

      void (async () => {
        try {
          const response = await fetch("/api/ai/stt", {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(45_000),
          });
          if (!response.ok) {
            let message = "No pudimos transcribir el audio. Escribe tu orden o intenta de nuevo.";
            try {
              const payload = (await response.json()) as { error?: { message?: string } };
              if (payload.error?.message) message = payload.error.message;
            } catch {
              // respuesta no JSON
            }
            throw new Error(message);
          }
          const payload = (await response.json()) as { transcript?: string };
          const transcript = (payload.transcript ?? "").trim();
          if (!transcript) {
            useAi.getState().setStatus("idle");
            useAi.getState().setError("No te escuché bien. Intenta de nuevo o escribe tu orden.");
            return;
          }
          useAi.getState().setError(null);
          await send(transcript, { speak: true });
        } catch (caught) {
          useAi.getState().setError(errorMessage(caught));
          useAi.getState().setStatus("error");
        }
      })();
    };

    recorderRef.current = recorder;
    recorder.start(250);
    useAi.getState().setStatus("listening");

    timerRef.current = window.setTimeout(() => {
      const active = recorderRef.current;
      if (active && active.state === "recording") active.stop();
    }, Math.max(5, maxAudioSeconds) * 1000);
  }, [
    capabilities,
    deepgramAvailable,
    integrations.data,
    maxAudioSeconds,
    send,
    stopPlayback,
  ]);

  React.useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopAll = React.useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    autoListenRef.current = false;
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        // Ignorar.
      }
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopPlayback();
    useAi.getState().setStatus("idle");
  }, [stopPlayback]);

  const clear = React.useCallback(() => {
    stopAll();
    useAi.getState().clearConversation();
  }, [stopAll]);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      discardRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      cleanupAudio(false);
    };
  }, [cleanupAudio]);

  React.useEffect(() => {
    if (panelOpen) return;
    const current = useAi.getState().status;
    if (current === "speaking" || current === "listening" || current === "transcribing") {
      runIdRef.current += 1;
      autoListenRef.current = false;
      discardRef.current = true;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // Ignorar.
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      stopPlayback();
      useAi.getState().setStatus("idle");
    }
  }, [panelOpen, stopPlayback]);

  return {
    messages,
    status,
    error,
    busy: isBusyStatus(status),
    listening: status === "listening",
    transcribing: status === "transcribing",
    speaking: status === "speaking",
    send,
    speak,
    startListening,
    stopListening,
    stop: stopAll,
    clear,
    canListen: capabilities.microphone && capabilities.mediaRecorder,
    voiceInputAvailable: deepgramAvailable,
    voiceOutputAvailable: elevenLabsAvailable,
  };
}

export { screenLabel };
