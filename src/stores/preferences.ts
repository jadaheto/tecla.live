"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DisplayMode, ThemeMode } from "@/types";
import { DASHBOARD_SECTIONS, type DashboardSectionId } from "@/lib/catalog";

export interface PreferencesState {
  theme: ThemeMode;
  displayMode: DisplayMode;
  autoThemeEnabled: boolean;
  autoThemeStart: string;
  autoThemeEnd: string;
  reduceMotion: boolean;
  ambientBackground: boolean;
  voiceEnabled: boolean;
  conversationMode: boolean;
  micConsent: boolean;
  memoryConsent: boolean;
  speakGreeting: boolean;
  volume: number;
  aiVoiceId: string;
  weatherLocation: string;
  weatherLat: number;
  weatherLon: number;
  dashboardOrder: DashboardSectionId[];
  setPreferences: (patch: Partial<PreferencesState>) => void;
  resetPreferences: () => void;
  moveSection: (id: DashboardSectionId, direction: "up" | "down") => void;
}

export const DEFAULT_PREFERENCES = {
  theme: "auto" as ThemeMode,
  displayMode: "normal" as DisplayMode,
  autoThemeEnabled: true,
  autoThemeStart: "18:30",
  autoThemeEnd: "06:30",
  reduceMotion: false,
  ambientBackground: true,
  voiceEnabled: true,
  conversationMode: false,
  micConsent: false,
  memoryConsent: false,
  speakGreeting: false,
  volume: 80,
  aiVoiceId: "",
  weatherLocation: "Sincelejo, Sucre, Colombia",
  weatherLat: 9.3047,
  weatherLon: -75.3978,
  dashboardOrder: DASHBOARD_SECTIONS.map((section) => section.id),
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFERENCES,
      setPreferences: (patch) => set(patch),
      resetPreferences: () => set(DEFAULT_PREFERENCES),
      moveSection: (id, direction) => {
        const order = [...get().dashboardOrder];
        const index = order.indexOf(id);
        if (index < 0) return;
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= order.length) return;
        const current = order[index];
        const other = order[target];
        if (!current || !other) return;
        order[index] = other;
        order[target] = current;
        set({ dashboardOrder: order });
      },
    }),
    {
      name: "tecla-preferences-v1",
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        theme: state.theme,
        displayMode: state.displayMode,
        autoThemeEnabled: state.autoThemeEnabled,
        autoThemeStart: state.autoThemeStart,
        autoThemeEnd: state.autoThemeEnd,
        reduceMotion: state.reduceMotion,
        ambientBackground: state.ambientBackground,
        voiceEnabled: state.voiceEnabled,
        conversationMode: state.conversationMode,
        micConsent: state.micConsent,
        memoryConsent: state.memoryConsent,
        speakGreeting: state.speakGreeting,
        volume: state.volume,
        aiVoiceId: state.aiVoiceId,
        weatherLocation: state.weatherLocation,
        weatherLat: state.weatherLat,
        weatherLon: state.weatherLon,
        dashboardOrder: state.dashboardOrder,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PreferencesState>;
        const order = Array.isArray(saved.dashboardOrder)
          ? saved.dashboardOrder.filter((id): id is DashboardSectionId =>
              DASHBOARD_SECTIONS.some((section) => section.id === id),
            )
          : [];
        const missing = DASHBOARD_SECTIONS.map((section) => section.id).filter(
          (id) => !order.includes(id),
        );
        return { ...current, ...saved, dashboardOrder: [...order, ...missing] };
      },
    },
  ),
);
