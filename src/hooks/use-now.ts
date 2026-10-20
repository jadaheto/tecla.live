"use client";

import { useSyncExternalStore } from "react";

let currentTime = 0;
let timer: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  currentTime = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (currentTime === 0) notify();
  if (timer === null) {
    timer = window.setInterval(notify, 20_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  if (currentTime === 0) currentTime = Date.now();
  return currentTime;
}

function getServerSnapshot(): number {
  return 0;
}

/** Reloj compartido y seguro para hidratación. Devuelve null antes del montaje. */
export function useNow(): Date | null {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return timestamp === 0 ? null : new Date(timestamp);
}
