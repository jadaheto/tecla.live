"use client";

import { create } from "zustand";

interface UiState {
  searchOpen: boolean;
  aiOpen: boolean;
  shortcutsOpen: boolean;
  settingsOpen: boolean;
  /** Pantalla ambiente: reloj, clima y carátula sobre fondo oscuro (auto detenido o cargando). */
  ambientOpen: boolean;
  /** Diálogo del control remoto por QR. */
  remoteOpen: boolean;
  setAmbientOpen: (open: boolean) => void;
  setRemoteOpen: (open: boolean) => void;
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
  ambientOpen: false,
  remoteOpen: false,
  setAmbientOpen: (ambientOpen) => set({ ambientOpen }),
  setRemoteOpen: (remoteOpen) => set({ remoteOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  closeOverlays: () =>
    set({ searchOpen: false, aiOpen: false, shortcutsOpen: false, settingsOpen: false, ambientOpen: false, remoteOpen: false }),
}));
