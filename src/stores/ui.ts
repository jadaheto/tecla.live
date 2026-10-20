"use client";

import { create } from "zustand";

interface UiState {
  searchOpen: boolean;
  aiOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  closeOverlays: () => void;
}

export const useUi = create<UiState>()((set) => ({
  searchOpen: false,
  aiOpen: false,
  shortcutsOpen: false,
  settingsOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  closeOverlays: () =>
    set({ searchOpen: false, aiOpen: false, shortcutsOpen: false, settingsOpen: false }),
}));
