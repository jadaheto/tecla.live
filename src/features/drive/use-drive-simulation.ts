"use client";

import * as React from "react";
import { clampSpeed, stepDriveSpeed } from "./drive-config";

interface DriveState {
  speed: number;
  accelerating: boolean;
  braking: boolean;
  autoPilot: boolean;
}

export function useDriveSimulation() {
  const [running, setRunning] = React.useState(false);
  const [speed, setSpeed] = React.useState(0);
  const [accelerating, setAccelerating] = React.useState(false);
  const [braking, setBraking] = React.useState(false);
  const [autoPilot, setAutoPilot] = React.useState(false);
  const stateRef = React.useRef<DriveState>({
    speed: 0,
    accelerating: false,
    braking: false,
    autoPilot: false,
  });

  const setPedal = React.useCallback((pedal: "accelerating" | "braking", pressed: boolean) => {
    stateRef.current[pedal] = pressed;
    if (pressed) {
      stateRef.current.autoPilot = false;
      setAutoPilot(false);
      if (pedal === "accelerating") {
        stateRef.current.braking = false;
        setBraking(false);
      } else {
        stateRef.current.accelerating = false;
        setAccelerating(false);
      }
    }
    if (pedal === "accelerating") setAccelerating(pressed);
    else setBraking(pressed);
  }, []);

  const releasePedals = React.useCallback(() => {
    stateRef.current.accelerating = false;
    stateRef.current.braking = false;
    setAccelerating(false);
    setBraking(false);
  }, []);

  const start = React.useCallback(() => {
    stateRef.current = {
      speed: 0,
      accelerating: false,
      braking: false,
      autoPilot: true,
    };
    setSpeed(0);
    setAccelerating(false);
    setBraking(false);
    setAutoPilot(true);
    setRunning(true);
  }, []);

  const launch = React.useCallback(() => {
    stateRef.current.autoPilot = true;
    setAutoPilot(true);
    if (!running) setRunning(true);
  }, [running]);

  const stop = React.useCallback(() => {
    stateRef.current = {
      speed: 0,
      accelerating: false,
      braking: false,
      autoPilot: false,
    };
    setSpeed(0);
    setAccelerating(false);
    setBraking(false);
    setAutoPilot(false);
    setRunning(false);
  }, []);

  React.useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    let lastPaint = 0;

    const tick = (now: number) => {
      const delta = (now - last) / 1_000;
      last = now;
      const state = stateRef.current;
      const next = stepDriveSpeed(
        state.speed,
        {
          accelerating: state.accelerating,
          braking: state.braking,
          autoPilot: state.autoPilot,
        },
        delta,
      );
      state.speed = next.speed;
      state.autoPilot = next.autoPilot;

      if (now - lastPaint > 55) {
        lastPaint = now;
        setSpeed(next.speed);
        setAutoPilot(next.autoPilot);
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [running]);

  React.useEffect(() => {
    const release = () => releasePedals();
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [releasePedals]);

  return {
    running,
    speed,
    clampedSpeed: clampSpeed(speed),
    accelerating,
    braking,
    autoPilot,
    start,
    launch,
    stop,
    setPedal,
    releasePedals,
  };
}
