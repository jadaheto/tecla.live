"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_ENGINE_ID,
  DEFAULT_FAVORITES,
  DEFAULT_SCENE_ID,
  DEFAULT_STUDIO,
  type DriveSceneId,
  type StudioSettings,
} from "@/features/drive/drive-config";

export interface DriveStoreState {
  engineId: string;
  sceneId: DriveSceneId;
  favorites: string[];
  useKmh: boolean;
  volume: number;
  studio: StudioSettings;
  /** Escena elegida automáticamente por hora y clima. */
  autoScene: boolean;
  /** Menos detalle en el lienzo y DPR 1 (recomendado en el Tesla). */
  performanceMode: boolean;
  /** Muestra paseo automático, arrancada y pedales (sin GPS). */
  demoMode: boolean;
  /** Volumen reducido para parqueaderos y zonas residenciales. */
  silentMode: boolean;
  /** Mejor 0–100 km/h medido con GPS (ms). */
  bestLaunchMs: number | null;
  setBestLaunch: (ms: number | null) => void;
  setSilentMode: (value: boolean) => void;
  setAutoScene: (value: boolean) => void;
  setPerformanceMode: (value: boolean) => void;
  setDemoMode: (value: boolean) => void;
  setEngine: (engineId: string) => void;
  setScene: (sceneId: DriveSceneId) => void;
  toggleFavorite: (engineId: string) => void;
  setUseKmh: (useKmh: boolean) => void;
  setVolume: (volume: number) => void;
  setStudio: (patch: Partial<StudioSettings>) => void;
  resetStudio: () => void;
}

export const useDriveStore = create<DriveStoreState>()(
  persist(
    (set, get) => ({
      engineId: DEFAULT_ENGINE_ID,
      sceneId: DEFAULT_SCENE_ID,
      favorites: [...DEFAULT_FAVORITES],
      useKmh: true,
      volume: 0.85,
      studio: { ...DEFAULT_STUDIO },
      autoScene: true,
      performanceMode: false,
      demoMode: false,
      silentMode: false,
      bestLaunchMs: null,
      setBestLaunch: (bestLaunchMs) => set({ bestLaunchMs }),
      setSilentMode: (silentMode) => set({ silentMode }),
      setAutoScene: (autoScene) => set({ autoScene }),
      setPerformanceMode: (performanceMode) => set({ performanceMode }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setEngine: (engineId) => set({ engineId }),
      setScene: (sceneId) => set({ sceneId }),
      toggleFavorite: (engineId) => {
        const favorites = get().favorites;
        set({
          favorites: favorites.includes(engineId)
            ? favorites.filter((id) => id !== engineId)
            : [...favorites, engineId],
        });
      },
      setUseKmh: (useKmh) => set({ useKmh }),
      setVolume: (volume) => set({ volume: Math.min(1.5, Math.max(0, volume)) }),
      setStudio: (patch) => set({ studio: { ...get().studio, ...patch } }),
      resetStudio: () => set({ studio: { ...DEFAULT_STUDIO } }),
    }),
    {
      name: "tecla-drive-v1",
      skipHydration: true,
      partialize: (state) => ({
        engineId: state.engineId,
        sceneId: state.sceneId,
        favorites: state.favorites,
        useKmh: state.useKmh,
        volume: state.volume,
        studio: state.studio,
        autoScene: state.autoScene,
        performanceMode: state.performanceMode,
        demoMode: state.demoMode,
        silentMode: state.silentMode,
        bestLaunchMs: state.bestLaunchMs,
      }),
    },
  ),
);
