"use client";

import { create } from "zustand";
import type { TeslaSnapshot } from "@/lib/integrations/tesla";

interface TeslaLiveState {
  snapshot: TeslaSnapshot | null;
  /** `true` estacionado, `false` en marcha, `null` sin datos o dormido. */
  parked: boolean | null;
  /** La Pantalla ambiente actual la abrió el modo carga. */
  openedByCharge: boolean;
  /** El usuario cerró la pantalla durante esta carga; se reinicia al terminar la carga. */
  chargeDismissed: boolean;
  setLive: (patch: Partial<Omit<TeslaLiveState, "setLive">>) => void;
}

/** Última lectura del Tesla disponible para toda la app (la publica TeslaProvider). */
export const useTeslaLive = create<TeslaLiveState>()((set) => ({
  snapshot: null,
  parked: null,
  openedByCharge: false,
  chargeDismissed: false,
  setLive: (patch) => set(patch),
}));
