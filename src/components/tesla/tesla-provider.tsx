"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { announce } from "@/features/ai/announce";
import { effectivePersona } from "@/features/ai/persona";
import { useAi } from "@/features/ai/store";
import { getPageController } from "@/features/media/player-bridge";
import { chargeModeDecision, isParked, teslaAlerts } from "@/features/tesla/alerts";
import { useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import { useTeslaLive } from "@/features/tesla/store";
import type { TeslaSnapshot } from "@/lib/integrations/tesla";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";

/**
 * Tesla en vivo para toda la app: mantiene la lectura del vehículo (cada 2
 * minutos, con la caché del servidor), publica estacionado/en marcha, abre
 * la Pantalla ambiente mientras carga (modo carga) y pronuncia los avisos
 * (batería baja, carga iniciada o completa, auto sin bloquear).
 */
export function TeslaProvider() {
  const pathname = usePathname();
  const status = useTeslaStatus();
  const connected = status.data?.connected ?? false;
  const vehicle = useTeslaVehicle(connected);
  const snapshot = vehicle.data ?? null;
  const chargeMode = usePreferences((state) => state.teslaChargeMode);
  const voiceAlerts = usePreferences((state) => state.teslaVoiceAlerts);
  const lowBattery = usePreferences((state) => state.teslaLowBatteryPercent);
  const ambientOpen = useUi((state) => state.ambientOpen);
  const previousRef = React.useRef<TeslaSnapshot | null>(null);
  const announcedRef = React.useRef(new Set<string>());

  // Publica la lectura para la Pantalla ambiente y las reglas de inactividad.
  React.useEffect(() => {
    useTeslaLive.getState().setLive({ snapshot, parked: isParked(snapshot) });
  }, [snapshot]);

  // Modo carga: abre o cierra la Pantalla ambiente según la carga y el movimiento.
  React.useEffect(() => {
    const live = useTeslaLive.getState();
    const ai = useAi.getState();
    const page = getPageController()?.getSnapshot();
    if (live.chargeDismissed && snapshot?.charging !== "charging") live.setLive({ chargeDismissed: false });
    const decision = chargeModeDecision({
      enabled: chargeMode,
      snapshot,
      ambientOpen,
      openedByCharge: live.openedByCharge,
      dismissed: live.chargeDismissed,
      videoOnScreen: Boolean(page && (page.kind === "youtube" || page.kind === "iptv") && page.isPlaying),
      assistantOpen: ai.panelOpen || ai.voiceOpen,
      pathname,
    });
    if (decision === "open") {
      live.setLive({ openedByCharge: true });
      useUi.getState().setAmbientOpen(true);
    } else if (decision === "close") {
      live.setLive({ openedByCharge: false });
      useUi.getState().setAmbientOpen(false);
    } else if (decision === "dismiss") {
      // El usuario la cerró con un toque: no volver a abrirla por esta misma carga.
      live.setLive({ openedByCharge: false, chargeDismissed: true });
    }
  }, [snapshot, chargeMode, ambientOpen, pathname]);

  // Avisos por voz con cada lectura nueva.
  React.useEffect(() => {
    if (!snapshot || snapshot.cached && previousRef.current?.observedAt === snapshot.observedAt) return;
    const previous = previousRef.current;
    previousRef.current = snapshot;
    if (!voiceAlerts) return;
    const prefs = usePreferences.getState();
    const alerts = teslaAlerts({
      previous,
      current: snapshot,
      persona: effectivePersona({ aiPersona: prefs.aiPersona, visualStyle: prefs.visualStyle }),
      lowBatteryPercent: lowBattery,
      announced: announcedRef.current,
    });
    for (const alert of alerts) {
      announcedRef.current.add(alert.id);
      void announce(alert.text);
    }
  }, [snapshot, voiceAlerts, lowBattery]);

  return null;
}
