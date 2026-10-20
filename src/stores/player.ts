"use client";

import { create } from "zustand";
import type { PlayerItem } from "@/types";

interface PlayerState {
  current: PlayerItem | null;
  queue: PlayerItem[];
  isPlaying: boolean;
  minimized: boolean;
  playbackBlocked: boolean;
  setCurrent: (item: PlayerItem | null) => void;
  updateCurrent: (patch: Partial<PlayerItem>) => void;
  setPlaying: (playing: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setPlaybackBlocked: (blocked: boolean) => void;
  setQueue: (queue: PlayerItem[]) => void;
  enqueue: (item: PlayerItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  playNext: () => PlayerItem | null;
  closePlayer: () => void;
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  current: null,
  queue: [],
  isPlaying: false,
  minimized: false,
  playbackBlocked: false,

  setCurrent: (item) =>
    set({
      current: item,
      isPlaying: false,
      playbackBlocked: false,
      minimized: item ? get().minimized : false,
    }),
  updateCurrent: (patch) =>
    set((state) =>
      state.current ? { current: { ...state.current, ...patch } } : state,
    ),
  setPlaying: (isPlaying) => set({ isPlaying, playbackBlocked: false }),
  setMinimized: (minimized) => set({ minimized }),
  setPlaybackBlocked: (playbackBlocked) => set({ playbackBlocked }),
  setQueue: (queue) => set({ queue }),
  enqueue: (item) =>
    set((state) => ({
      queue: state.queue.some((queued) => queued.id === item.id)
        ? state.queue
        : [...state.queue, item],
    })),
  removeFromQueue: (id) =>
    set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
  clearQueue: () => set({ queue: [] }),
  playNext: () => {
    const { queue, current } = get();
    const next = queue[0] ?? null;
    if (!next) return null;
    set({
      current: next,
      queue: queue.slice(1),
      isPlaying: true,
      playbackBlocked: false,
      minimized: false,
    });
    if (current && current.id !== next.id) {
      // El reproductor que observa el cambio se encarga de la carga real.
    }
    return next;
  },
  closePlayer: () =>
    set({ current: null, isPlaying: false, minimized: false, playbackBlocked: false }),
}));
