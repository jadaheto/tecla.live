"use client";

import * as React from "react";
import { DriveAudioEngine } from "./audio-engine";
import type { DriveCanvasFrame } from "./drive-canvas";
import { PARKED_AFTER_SECONDS, type DriveEngine, type StudioSettings } from "./drive-config";
import {
  DEFAULT_INPUTS,
  createDriveState,
  sceneSpeedFactor,
  shiftGear,
  stepDrive,
  type DriveMode,
  type DriveSimInputs,
  type DriveSimState,
} from "./engine-model";
import type { DriveSceneRenderer } from "./scene-renderer";

export interface DriveEngineView {
  speedKmh: number;
  rpm: number;
  gear: number;
  throttle: number;
  mode: DriveMode;
  manualGear: boolean;
}

const UI_INTERVAL_MS = 66;

/**
 * Bucle principal de TECLA DRIVE: avanza la simulación cada cuadro, alimenta
 * el motor de audio y el lienzo mediante refs, y publica un resumen para la
 * interfaz a ~15 Hz para no re-renderizar React 60 veces por segundo.
 */
export function useDriveEngine(engine: DriveEngine, studio: StudioSettings, volume: number, muted: boolean) {
  const simRef = React.useRef<DriveSimState>(createDriveState(engine));
  const inputsRef = React.useRef<DriveSimInputs>({ ...DEFAULT_INPUTS });
  const engineRef = React.useRef(engine);
  const audioRef = React.useRef<DriveAudioEngine | null>(null);
  const rendererRef = React.useRef<DriveSceneRenderer | null>(null);
  const frameRef = React.useRef<DriveCanvasFrame>({ speedKmh: 0, speedFactor: 0 });
  const [view, setView] = React.useState<DriveEngineView>(() => ({
    speedKmh: 0,
    rpm: engine.idle,
    gear: 1,
    throttle: 0,
    mode: "idle",
    manualGear: false,
  }));
  const [audioOn, setAudioOn] = React.useState(false);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [parked, setParked] = React.useState(false);
  const [backend, setBackend] = React.useState<"worklet" | "script" | null>(null);
  const stoppedSecondsRef = React.useRef(0);
  const parkedRef = React.useRef(false);
  const externalDuckRef = React.useRef(1);

  const applyDuck = React.useCallback(() => {
    const parkedDuck = parkedRef.current ? 0.45 : 1;
    audioRef.current?.setDuck(parkedDuck * externalDuckRef.current);
  }, []);

  React.useEffect(() => {
    engineRef.current = engine;
    audioRef.current?.setEngine(engine);
    const sim = simRef.current;
    if (sim.mode === "idle" && sim.speedKmh < 1) {
      sim.rpm = engine.idle;
      sim.gear = 1;
    }
  }, [engine]);

  React.useEffect(() => {
    audioRef.current?.setStudio(studio);
  }, [studio]);

  React.useEffect(() => {
    audioRef.current?.setVolume(volume);
    audioRef.current?.setMuted(muted);
  }, [volume, muted]);

  React.useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastPaint = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1_000) || 0.016;
      last = now;
      const currentEngine = engineRef.current;
      const inputs = inputsRef.current;
      inputs.curvatureAhead = rendererRef.current?.curvatureAhead() ?? 0;
      const { state, events } = stepDrive(currentEngine, simRef.current, inputs, dt);
      simRef.current = state;
      frameRef.current = {
        speedKmh: state.speedKmh,
        speedFactor: sceneSpeedFactor(currentEngine, state),
      };
      const audio = audioRef.current;
      if (audio) {
        audio.update(state.speedKmh, state.rpm, state.throttle);
        if (events.shifted) audio.shiftClunk();
        if (events.liftOff) audio.liftOff();
      }
      // Estacionado largo: baja el motor a un ralentí suave.
      if (state.speedKmh < 1 && state.mode !== "rev") {
        stoppedSecondsRef.current += dt;
      } else {
        stoppedSecondsRef.current = 0;
      }
      const shouldPark = stoppedSecondsRef.current >= PARKED_AFTER_SECONDS;
      if (shouldPark !== parkedRef.current) {
        parkedRef.current = shouldPark;
        setParked(shouldPark);
        applyDuck();
      }
      if (now - lastPaint > UI_INTERVAL_MS) {
        lastPaint = now;
        setView({
          speedKmh: state.speedKmh,
          rpm: state.rpm,
          gear: state.gear,
          throttle: state.throttle,
          mode: state.mode,
          manualGear: state.manualGear,
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [applyDuck]);

  React.useEffect(() => {
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const startAudio = React.useCallback(async (): Promise<boolean> => {
    setAudioError(null);
    try {
      if (!audioRef.current) {
        const audio = new DriveAudioEngine(engineRef.current);
        audio.setStudio(studio);
        audio.setVolume(volume);
        audio.setMuted(muted);
        audioRef.current = audio;
      }
      await audioRef.current.start();
      applyDuck();
      setAudioOn(true);
      setBackend(audioRef.current.backend);
      return true;
    } catch {
      setAudioError("El navegador no permitió iniciar el audio. El paisaje sigue disponible.");
      setAudioOn(false);
      return false;
    }
  }, [studio, volume, muted, applyDuck]);

  /** Atenuación externa (por ejemplo mientras habla TECLA AI). */
  const setExternalDuck = React.useCallback(
    (factor: number) => {
      externalDuckRef.current = factor;
      applyDuck();
    },
    [applyDuck],
  );

  /** Giro real del GPS para curvar la carretera (null = carretera sintética). */
  const setTurnRate = React.useCallback((degPerSec: number | null) => {
    rendererRef.current?.setExternalTurnRate(degPerSec);
  }, []);

  const stopAudio = React.useCallback(() => {
    audioRef.current?.stop();
    setAudioOn(false);
  }, []);

  const setMode = React.useCallback((mode: DriveMode) => {
    const sim = simRef.current;
    if (sim.mode === "rev" && mode !== "rev") {
      // Soltar el acelerador en vacío dispara petardeos.
      audioRef.current?.liftOff();
    }
    sim.mode = mode;
    if (mode === "launch") {
      sim.speedKmh = 0;
      sim.gear = 1;
      sim.rpm = engineRef.current.idle;
      sim.launchTicks = 0;
    }
    if (mode === "cruise") {
      sim.cruiseTarget = Math.max(sim.cruiseTarget, 88);
      sim.cruiseTimer = 0;
    }
  }, []);

  const setGpsSpeed = React.useCallback((speedKmh: number) => {
    inputsRef.current.gpsSpeedKmh = speedKmh;
  }, []);

  const setPedal = React.useCallback((pedal: "accelerating" | "braking", pressed: boolean) => {
    const inputs = inputsRef.current;
    inputs[pedal] = pressed;
    if (pressed) {
      if (pedal === "accelerating") inputs.braking = false;
      else inputs.accelerating = false;
      if (simRef.current.mode === "cruise" || simRef.current.mode === "launch") simRef.current.mode = "idle";
    }
  }, []);

  const shift = React.useCallback((direction: 1 | -1) => {
    const next = shiftGear(simRef.current, direction);
    if (next !== simRef.current) {
      simRef.current = next;
      audioRef.current?.shiftClunk();
      audioRef.current?.liftOff();
    }
  }, []);

  const setManualGear = React.useCallback((manual: boolean) => {
    simRef.current.manualGear = manual;
  }, []);

  const reset = React.useCallback(() => {
    simRef.current = createDriveState(engineRef.current);
    inputsRef.current = { ...DEFAULT_INPUTS };
  }, []);

  return {
    view,
    audioOn,
    audioError,
    parked,
    backend,
    setExternalDuck,
    setTurnRate,
    frameRef,
    rendererRef,
    startAudio,
    stopAudio,
    setMode,
    setGpsSpeed,
    setPedal,
    shift,
    setManualGear,
    reset,
  };
}
