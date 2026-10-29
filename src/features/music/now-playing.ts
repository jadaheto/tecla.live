/** Estado de reproducción de Spotify tal como lo devuelve /api/spotify/now-playing. */
export interface NowPlaying {
  playing: boolean;
  progressMs: number;
  durationMs: number;
  track: {
    id: string;
    name: string;
    artists: string[];
    album: string | null;
    imageUrl: string | null;
    externalUrl: string | null;
  } | null;
  device: string | null;
  deviceVolume: number | null;
}

/**
 * Posición estimada de la canción entre dos lecturas de la API: a la última
 * posición conocida se le suma el tiempo transcurrido si estaba sonando.
 */
export function estimateProgressMs(data: Pick<NowPlaying, "playing" | "progressMs" | "durationMs">, updatedAt: number, now: number): number {
  const elapsed = data.playing ? Math.max(0, now - updatedAt) : 0;
  const position = data.progressMs + elapsed;
  return data.durationMs > 0 ? Math.min(data.durationMs, position) : position;
}
