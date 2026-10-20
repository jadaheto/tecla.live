"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { M3uChannel } from "@/lib/integrations/m3u";
import { makeId } from "@/lib/utils";

export interface IptvPlaylist {
  id: string;
  name: string;
  channels: M3uChannel[];
  importedAt: string;
}

interface IptvState {
  playlists: IptvPlaylist[];
  addPlaylist: (name: string, channels: M3uChannel[]) => string;
  removePlaylist: (id: string) => void;
  clearAll: () => void;
}

export const useIptv = create<IptvState>()(
  persist(
    (set) => ({
      playlists: [],
      addPlaylist: (name, channels) => {
        const id = makeId("iptv");
        const playlist: IptvPlaylist = {
          id,
          name,
          channels: channels.slice(0, 5000),
          importedAt: new Date().toISOString(),
        };
        set((state) => ({ playlists: [playlist, ...state.playlists].slice(0, 5) }));
        return id;
      },
      removePlaylist: (id) =>
        set((state) => ({ playlists: state.playlists.filter((playlist) => playlist.id !== id) })),
      clearAll: () => set({ playlists: [] }),
    }),
    {
      name: "tecla-iptv-v1",
      version: 1,
      skipHydration: true,
    },
  ),
);
