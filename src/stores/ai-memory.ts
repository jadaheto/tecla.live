"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { makeId } from "@/lib/utils";

export const AI_MEMORY_KEYS = [
  "musica",
  "videos",
  "emisoras",
  "apps",
  "tema",
  "idioma",
  "ciudad",
] as const;

export type AiMemoryKey = (typeof AI_MEMORY_KEYS)[number];

export interface AiMemoryEntry {
  id: string;
  key: AiMemoryKey;
  value: string;
  updatedAt: string;
}

interface AiMemoryState {
  entries: AiMemoryEntry[];
  remember: (key: AiMemoryKey, value: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useAiMemory = create<AiMemoryState>()(
  persist(
    (set) => ({
      entries: [],
      remember: (key, value) => {
        const clean = value.trim().slice(0, 160);
        if (!clean) return;
        set((state) => ({
          entries: [
            {
              id: makeId("mem"),
              key,
              value: clean,
              updatedAt: new Date().toISOString(),
            },
            ...state.entries.filter((entry) => !(entry.key === key && entry.value === clean)),
          ].slice(0, 20),
        }));
      },
      remove: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "tecla-ai-memory-v1",
      version: 1,
      skipHydration: true,
    },
  ),
);
