"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAi } from "@/features/ai/store";
import { useTeclaActions } from "@/features/ai/hooks/use-tecla-actions";
import { errorMessage } from "@/lib/http";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";
import { useAiMemory } from "@/stores/ai-memory";
import { useIntegrations } from "@/features/integrations/hooks";
import { getMediaController } from "@/features/media/player-bridge";
import { effectivePersona } from "@/features/ai/persona";
import { getKittVoiceId } from "@/features/ai/kitt-voice";
import { claimPlayback } from "@/features/media/playback-sources";
import { getSpotifyWebPlayerState } from "@/features/music/spotify-web-player-bridge";
import { clearVoiceLevel, setVoiceLevel } from "@/features/ai/voice-level";
import { splitSentences, streamAiChat } from "@/features/ai/stream-client";
import { farewellReply, isFarewell } from "@/features/ai/farewell";
import type {
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
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const discardRef = React.useRef(false);
  const ttsAbortRef = React.useRef<AbortController | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const resumeAfterSpeakRef = React.useRef(false);
  const autoListenRef = React.useRef(false);
  /** La escucha actual la inició el modo conversación (no un toque): si no hay voz, cerrar en silencio. */
  const autoStartedRef = React.useRef(false);
  /** Tras una despedida: al terminar de hablar, cerrar el HUD y no volver a escuchar. */
  const closeAfterSpeakRef = React.useRef(false);
  const startListeningRef = React.useRef<() => Promise<void>>(async () => {});
  /** Detector de silencio: cierra la grabación sola cuando el usuario termina de hablar. */
  const vadRef = React.useRef<{ context: AudioContext; interval: number } | null>(null);

  const stopVad = React.useCallback(() => {
    const vad = vadRef.current;
    clearVoiceLevel();
    if (!vad) return;
    vadRef.current = null;
    window.clearInterval(vad.interval);
    void vad.context.close().catch(() => undefined);
  }, []);
  /** Medidor de la voz sintetizada, para que el orbe lata al responder. */
  const ttsContextRef = React.useRef<AudioContext | null>(null);
  const ttsMeterRef = React.useRef<number | null>(null);

  const stopTtsMeter = React.useCallback(() => {
    if (ttsMeterRef.current !== null) {
      window.clearInterval(ttsMeterRef.current);
      ttsMeterRef.current = null;
    }
    clearVoiceLevel();
  }, []);

  const attachTtsMeter = React.useCallback((audio: HTMLAudioElement) => {
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      if (!ttsContextRef.current) ttsContextRef.current = new AudioCtor();
      const context = ttsContextRef.current;
      void context.resume().catch(() => undefined);
      // Si el contexto no corre, enrutar el audio por él lo silenciaría: no medimos.
      if (context.state !== "running") return;
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(context.destination);
      const samples = new Float32Array(analyser.fftSize);
      ttsMeterRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (let i = 0; i < samples.length; i += 1) energy += (samples[i] ?? 0) ** 2;
        setVoiceLevel(Math.min(1, Math.sqrt(energy / samples.length) * 3), "tts");
      }, 50);
    } catch {
      // Sin medidor: el orbe usa su animación base.
    }
  }, []);
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
    stopTtsMeter();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (restoreMedia && resumeAfterSpeakRef.current) {
      resumeAfterSpeakRef.current = false;
      void getMediaController()?.play().catch(() => undefined);
    }
  }, [stopTtsMeter]);

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
            ...voicePayload(),
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
        attachTtsMeter(audio);

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
        if (closeAfterSpeakRef.current) {
          closeAfterSpeakRef.current = false;
          useAi.getState().setVoiceOpen(false);
          return;
        }
        if (
          usePreferences.getState().conversationMode &&
          (useAi.getState().panelOpen || useAi.getState().voiceOpen)
        ) {
          autoListenRef.current = true;
          autoStartedRef.current = true;
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
    [cleanupAudio, attachTtsMeter],
  );

  /**
   * Voz por frases: mientras el texto llega en streaming, cada frase completa
   * se convierte en voz y se reproduce en orden. La primera frase suena
   * mucho antes de que termine la respuesta.
   */
  const speechRef = React.useRef<{
    active: boolean;
    finished: boolean;
    playing: boolean;
    queue: Array<Promise<Blob | null>>;
    controller: AbortController | null;
  }>({ active: false, finished: false, playing: false, queue: [], controller: null });

  const finalizeSpeech = React.useCallback(() => {
    const speech = speechRef.current;
    speech.active = false;
    speech.playing = false;
    speech.queue = [];
    speech.controller = null;
    useAi.getState().setStatus("idle");
    cleanupAudio(true);
    if (closeAfterSpeakRef.current) {
      closeAfterSpeakRef.current = false;
      useAi.getState().setVoiceOpen(false);
      return;
    }
    if (
      usePreferences.getState().conversationMode &&
      (useAi.getState().panelOpen || useAi.getState().voiceOpen)
    ) {
      autoListenRef.current = true;
      autoStartedRef.current = true;
      window.setTimeout(() => {
        if (autoListenRef.current) void startListeningRef.current();
      }, 350);
    }
  }, [cleanupAudio]);

  const drainSpeech = React.useCallback(async () => {
    const speech = speechRef.current;
    if (speech.playing) return;
    speech.playing = true;
    while (speech.active && speech.queue.length > 0) {
      const next = speech.queue.shift();
      if (!next) break;
      const blob = await next.catch(() => null);
      if (!speech.active) return;
      if (!blob || !blob.size) continue;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, usePreferences.getState().volume / 100));
      audioRef.current = audio;
      audioUrlRef.current = url;
      attachTtsMeter(audio);
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      stopTtsMeter();
      if (audioUrlRef.current === url) {
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
      }
      audioRef.current = null;
    }
    speech.playing = false;
    if (speech.active && speech.finished && speech.queue.length === 0) finalizeSpeech();
  }, [attachTtsMeter, finalizeSpeech, stopTtsMeter]);

  const beginSpeech = React.useCallback(async () => {
    const speech = speechRef.current;
    if (speech.active) return;
    cleanupAudio(false);
    autoListenRef.current = false;
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    speech.active = true;
    speech.finished = false;
    speech.playing = false;
    speech.queue = [];
    speech.controller = controller;
    useAi.getState().setStatus("speaking");
    const media = getMediaController();
    if (media?.getSnapshot().isPlaying) {
      const paused = await media.pause();
      resumeAfterSpeakRef.current = paused.ok;
    }
  }, [cleanupAudio]);

  const enqueueSpeech = React.useCallback(
    (sentence: string) => {
      const speech = speechRef.current;
      const clean = sentence.trim();
      if (!speech.active || !clean || !speech.controller) return;
      const signal = speech.controller.signal;
      const request = fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean.slice(0, 1000),
          ...voicePayload(),
        }),
        signal,
      })
        .then((response) => (response.ok ? response.blob() : null))
        .catch(() => null);
      speech.queue.push(request);
      void drainSpeech();
    },
    [drainSpeech],
  );

  const finishSpeech = React.useCallback(() => {
    const speech = speechRef.current;
    if (!speech.active) return;
    speech.finished = true;
    if (!speech.playing && speech.queue.length === 0) finalizeSpeech();
  }, [finalizeSpeech]);

  const send = React.useCallback(
    async (raw: string, options?: { speak?: boolean }) => {
      const text = raw.trim().slice(0, 2000);
      if (!text) return;

      const currentStatus = useAi.getState().status;
      if (currentStatus === "speaking") {
        speechRef.current.active = false;
        stopPlayback();
      } else if (isBusyStatus(currentStatus)) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;

      const store = useAi.getState();
      store.setError(null);
      store.addMessage({ role: "user", content: text });

      // Despedida por voz: respuesta local breve y cierre del HUD, sin DeepSeek.
      if (options?.speak && isFarewell(text)) {
        const reply = farewellReply(text, effectivePersona(usePreferences.getState()));
        store.addMessage({ role: "assistant", content: reply });
        closeAfterSpeakRef.current = true;
        if (ttsConfiguredRef.current && usePreferences.getState().voiceEnabled) {
          await speak(reply);
        } else {
          closeAfterSpeakRef.current = false;
          useAi.getState().setStatus("idle");
          window.setTimeout(() => useAi.getState().setVoiceOpen(false), 1_200);
        }
        return;
      }

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
        persona: effectivePersona(usePreferences.getState()),
        visualStyle: usePreferences.getState().visualStyle,
        assistantName: usePreferences.getState().aiName,
        ...(getSpotifyWebPlayerState().deviceId
          ? { spotifyDeviceId: getSpotifyWebPlayerState().deviceId ?? undefined }
          : {}),
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
      const wantsVoice = Boolean(options?.speak) && ttsConfiguredRef.current && usePreferences.getState().voiceEnabled;
      let placeholderId: string | null = null;
      let partial = "";
      let spokenUpTo = 0;

      try {
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          if (runIdRef.current !== runId) return;

          const history = useAi
            .getState()
            .messages.filter((message) => message.id !== placeholderId)
            .slice(-12)
            .map((message) => ({ role: message.role, content: message.content }));

          partial = "";
          spokenUpTo = 0;
          const response = await streamAiChat(
            {
              messages: history,
              context,
              ...(toolExchange ? { toolExchange } : {}),
            },
            (delta) => {
              if (runIdRef.current !== runId) return;
              partial += delta;
              if (!placeholderId) {
                placeholderId = useAi.getState().addMessage({ role: "assistant", content: partial });
              } else {
                useAi.getState().updateMessage(placeholderId, { content: partial });
              }
              if (wantsVoice) {
                const { sentences, consumed } = splitSentences(partial.slice(spokenUpTo));
                if (sentences.length > 0) {
                  spokenUpTo += consumed;
                  void beginSpeech().then(() => {
                    if (runIdRef.current !== runId) return;
                    for (const sentence of sentences) enqueueSpeech(sentence);
                  });
                }
              }
            },
            controller.signal,
          );

          if (runIdRef.current !== runId) return;

          if (response.pendingActions.length === 0) {
            const finalContent = response.content || partial || "Listo.";
            if (placeholderId) {
              useAi.getState().updateMessage(placeholderId, {
                content: finalContent,
                actions: actionSummaries.length > 0 ? actionSummaries : undefined,
              });
            } else {
              useAi.getState().addMessage({
                role: "assistant",
                content: finalContent,
                actions: actionSummaries.length > 0 ? actionSummaries : undefined,
              });
            }
            if (wantsVoice) {
              const tail = finalContent.slice(spokenUpTo).trim();
              if (speechRef.current.active) {
                if (tail) enqueueSpeech(tail);
                finishSpeech();
              } else {
                useAi.getState().setStatus("idle");
                await speak(finalContent);
              }
            } else {
              useAi.getState().setStatus("idle");
            }
            return;
          }
          // Hubo acciones: el texto parcial de este paso no es la respuesta final.
          if (placeholderId && partial) {
            useAi.getState().updateMessage(placeholderId, { content: "" });
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
          // Spotify se ordenó desde el servidor: lo que sonaba en esta pantalla se pausa.
          if (serverResults.some((item) => item.name === "play_spotify" && item.ok)) claimPlayback("spotify");
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
    [capabilities, executeActions, pathname, speak, stopPlayback, beginSpeech, enqueueSpeech, finishSpeech],
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
    // Si llegamos aquí por un toque (no por el modo conversación), no es escucha automática.
    if (!autoListenRef.current) autoStartedRef.current = false;
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

    // Fin de frase automático: tras voz detectada, 1,4 s de silencio envían la orden;
    // sin voz en 8 s se descarta. Así se puede hablar sin tocar la pantalla.
    stopVad();
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        const context = new AudioCtor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const startedAt = Date.now();
        let voicedMs = 0;
        let lastVoiceAt = 0;
        // Piso de ruido adaptativo: sigue el mínimo reciente y sube despacio. En el
        // carro, el ruido de rodadura no debe contar como voz ni impedir el silencio.
        let noiseFloor = 0;
        const interval = window.setInterval(() => {
          const active = recorderRef.current;
          if (!active || active.state !== "recording") {
            stopVad();
            return;
          }
          analyser.getFloatTimeDomainData(samples);
          let energy = 0;
          for (let i = 0; i < samples.length; i += 1) energy += (samples[i] ?? 0) ** 2;
          const rms = Math.sqrt(energy / samples.length);
          noiseFloor = rms < noiseFloor ? rms : Math.min(noiseFloor * 1.01 + 0.0002, 0.12);
          const threshold = Math.max(0.02, noiseFloor * 2.5);
          setVoiceLevel(Math.min(1, rms * 6), "mic");
          const now = Date.now();
          if (rms > threshold) {
            voicedMs += 100;
            lastVoiceAt = now;
          }
          const spoke = voicedMs >= 400;
          if (spoke && now - lastVoiceAt >= 1_400) {
            stopVad();
            active.stop();
          } else if (!spoke && now - startedAt >= 8_000) {
            discardRef.current = true;
            stopVad();
            active.stop();
            if (autoStartedRef.current) {
              // Escucha automática tras responder: sin voz, el HUD se cierra en silencio.
              autoStartedRef.current = false;
              useAi.getState().setVoiceOpen(false);
            } else {
              useAi.getState().setError("No escuché nada. Toca el micrófono y vuelve a intentarlo.");
            }
          }
        }, 100);
        vadRef.current = { context, interval };
      }
    } catch {
      // Sin analizador: la grabación se cierra con el botón o el tiempo máximo.
    }

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

    // Los fragmentos pertenecen a ESTE grabador. Con una lista compartida, el último
    // trozo de una grabación que se detiene podía colarse en la siguiente y el WebM
    // perdía la cabecera (Deepgram: «corrupt or unsupported data»).
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const recordedType = recorder.mimeType || mimeType || "audio/webm";
      stopVad();
      stream.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (recorderRef.current === recorder) recorderRef.current = null;

      if (discardRef.current) {
        discardRef.current = false;
        useAi.getState().setStatus("idle");
        return;
      }

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
          // send() rechaza órdenes mientras el estado sea "transcribing".
          // Hay que liberar el estado antes de encadenar la transcripción.
          useAi.getState().setStatus("idle");
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
    stopVad,
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

/**
 * Voz para ElevenLabs: la elegida en Ajustes; si no hay, con el estilo
 * «El auto fantástico» se usa la voz grave recomendada por el servidor.
 */
function voicePayload(): { voiceId?: string } {
  const prefs = usePreferences.getState();
  if (prefs.aiVoiceId) return { voiceId: prefs.aiVoiceId };
  if (prefs.visualStyle === "kitt") {
    const kitt = getKittVoiceId();
    if (kitt) return { voiceId: kitt };
  }
  return {};
}
