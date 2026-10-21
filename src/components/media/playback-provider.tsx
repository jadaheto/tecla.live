"use client";

import * as React from "react";
import { registerBackgroundController } from "@/features/media/player-bridge";
import { startPlaybackArbiter } from "@/features/media/playback-sources";
import { radioMediaController, setRadioVolume } from "@/features/radio/radio-audio";
import { spotifyMediaController } from "@/features/music/spotify-web-player-bridge";
import { usePlayer } from "@/stores/player";
import { usePreferences } from "@/stores/preferences";

/**
 * Mantiene vivas las fuentes de fondo (radio y Spotify) en toda la app:
 * arranca el árbitro de reproducción, sincroniza el volumen y expone a
 * TECLA AI el controlador de la fuente que está sonando.
 */
export function PlaybackProvider() {
  const kind = usePlayer((state) => state.current?.kind ?? null);
  const volume = usePreferences((state) => state.volume);

  React.useEffect(() => {
    startPlaybackArbiter();
  }, []);

  React.useEffect(() => {
    setRadioVolume(volume);
  }, [volume]);

  React.useEffect(() => {
    if (kind === "radio") return registerBackgroundController(radioMediaController);
    if (kind === "spotify") return registerBackgroundController(spotifyMediaController);
    return undefined;
  }, [kind]);

  return null;
}
