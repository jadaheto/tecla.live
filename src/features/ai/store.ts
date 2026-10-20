"use client";

import { create } from "zustand";
import type { AiChatMessage, AiVisualState } from "@/types";
import { makeId } from "@/lib/utils";

interface AiState {
  panelOpen: boolean;
  pendingPrompt: string | null;
  messages: AiChatMessage[];
  status: AiVisualState;
  error: string | null;
  setStatus: (status: AiVisualState) => void;
  setError: (error: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  openWithPrompt: (prompt?: string) => void;
  setPendingPrompt: (prompt: string | null) => void;
  addMessage: (message: Omit<AiChatMessage, "id" | "createdAt">) => string;
  updateMessage: (id: string, patch: Partial<Omit<AiChatMessage, "id">>) => void;
  clearConversation: () => void;
}

export const useAi = create<AiState>()((set) => ({
  panelOpen: false,
  pendingPrompt: null,
  messages: [],
  status: "idle",
  error: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  openWithPrompt: (prompt) =>
    set({ panelOpen: true, ...(prompt ? { pendingPrompt: prompt } : {}) }),
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  addMessage: (message) => {
    const id = makeId("msg");
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id, createdAt: new Date().toISOString() },
      ].slice(-60),
    }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    })),
  clearConversation: () => set({ messages: [], status: "idle", error: null }),
}));
