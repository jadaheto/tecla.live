"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  HistoryEntry,
  MediaKind,
  Playlist,
  SavedDestination,
  SavedFavorite,
} from "@/types";
import { makeId } from "@/lib/utils";

const MAX_HISTORY = 80;
const MAX_SEARCHES = 12;
const MAX_FAVORITES = 300;

export function libraryKey(kind: MediaKind, providerId: string): string {
  return `${kind}:${providerId}`;
}

export interface RecentDestination {
  query: string;
  provider: "waze" | "maps";
  createdAt: string;
}

export interface LibraryState {
  favorites: SavedFavorite[];
  history: HistoryEntry[];
  playlists: Playlist[];
  destinations: SavedDestination[];
  recentDestinations: RecentDestination[];
  searches: string[];
  addFavorite: (favorite: Omit<SavedFavorite, "addedAt">) => void;
  removeFavorite: (kind: MediaKind, providerId: string) => void;
  toggleFavorite: (favorite: Omit<SavedFavorite, "addedAt">) => boolean;
  recordProgress: (entry: Omit<HistoryEntry, "lastWatchedAt">) => void;
  removeHistory: (kind: MediaKind, providerId: string) => void;
  clearHistory: () => void;
  clearFavorites: () => void;
  clearPlaylists: () => void;
  clearDestinations: () => void;
  createPlaylist: (name: string) => string;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, item: Omit<SavedFavorite, "addedAt">) => void;
  removeFromPlaylist: (playlistId: string, kind: MediaKind, providerId: string) => void;
  addDestination: (destination: Omit<SavedDestination, "id" | "createdAt">) => SavedDestination;
  addRecentDestination: (query: string, provider: "waze" | "maps") => void;
  clearRecentDestinations: () => void;
  removeDestination: (id: string) => void;
  addSearch: (query: string) => void;
  clearSearches: () => void;
  importLibrary: (data: Partial<Pick<LibraryState, "favorites" | "history" | "playlists">>) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      history: [],
      playlists: [],
      destinations: [],
      recentDestinations: [],
      searches: [],

      addFavorite: (favorite) => {
        const exists = get().favorites.some(
          (item) => item.kind === favorite.kind && item.providerId === favorite.providerId,
        );
        if (exists) return;
        set((state) => ({
          favorites: [
            { ...favorite, addedAt: new Date().toISOString() },
            ...state.favorites,
          ].slice(0, MAX_FAVORITES),
        }));
      },

      removeFavorite: (kind, providerId) =>
        set((state) => ({
          favorites: state.favorites.filter(
            (item) => !(item.kind === kind && item.providerId === providerId),
          ),
        })),

      toggleFavorite: (favorite) => {
        const exists = get().favorites.some(
          (item) => item.kind === favorite.kind && item.providerId === favorite.providerId,
        );
        if (exists) {
          get().removeFavorite(favorite.kind, favorite.providerId);
          return false;
        }
        get().addFavorite(favorite);
        return true;
      },

      recordProgress: (entry) =>
        set((state) => {
          const now = new Date().toISOString();
          const existing = state.history.find(
            (item) => item.kind === entry.kind && item.providerId === entry.providerId,
          );
          const next: HistoryEntry = {
            ...entry,
            positionSeconds: Math.max(0, Math.floor(entry.positionSeconds)),
            durationSeconds: Math.max(0, Math.floor(entry.durationSeconds || existing?.durationSeconds || 0)),
            lastWatchedAt: now,
          };
          return {
            history: [next, ...state.history.filter((item) => item !== existing)].slice(
              0,
              MAX_HISTORY,
            ),
          };
        }),

      removeHistory: (kind, providerId) =>
        set((state) => ({
          history: state.history.filter(
            (item) => !(item.kind === kind && item.providerId === providerId),
          ),
        })),

      clearHistory: () => set({ history: [] }),
      clearFavorites: () => set({ favorites: [] }),
      clearPlaylists: () => set({ playlists: [] }),
      clearDestinations: () => set({ destinations: [] }),

      createPlaylist: (name) => {
        const id = makeId("list");
        const now = new Date().toISOString();
        set((state) => ({
          playlists: [
            { id, name, items: [], createdAt: now, updatedAt: now },
            ...state.playlists,
          ],
        }));
        return id;
      },

      deletePlaylist: (id) =>
        set((state) => ({ playlists: state.playlists.filter((list) => list.id !== id) })),

      addToPlaylist: (playlistId, item) =>
        set((state) => ({
          playlists: state.playlists.map((list) => {
            if (list.id !== playlistId) return list;
            if (
              list.items.some(
                (current) => current.kind === item.kind && current.providerId === item.providerId,
              )
            ) {
              return list;
            }
            return {
              ...list,
              items: [...list.items, { ...item, addedAt: new Date().toISOString() }],
              updatedAt: new Date().toISOString(),
            };
          }),
        })),

      removeFromPlaylist: (playlistId, kind, providerId) =>
        set((state) => ({
          playlists: state.playlists.map((list) =>
            list.id === playlistId
              ? {
                  ...list,
                  items: list.items.filter(
                    (item) => !(item.kind === kind && item.providerId === providerId),
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : list,
          ),
        })),

      addDestination: (destination) => {
        const created: SavedDestination = {
          ...destination,
          id: makeId("place"),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ destinations: [created, ...state.destinations].slice(0, 40) }));
        return created;
      },

      removeDestination: (id) =>
        set((state) => ({
          destinations: state.destinations.filter((destination) => destination.id !== id),
        })),

      addRecentDestination: (query, provider) => {
        const clean = query.trim();
        if (clean.length < 2) return;
        set((state) => ({
          recentDestinations: [
            { query: clean, provider, createdAt: new Date().toISOString() },
            ...state.recentDestinations.filter(
              (item) => !(item.query.toLowerCase() === clean.toLowerCase() && item.provider === provider),
            ),
          ].slice(0, 10),
        }));
      },

      clearRecentDestinations: () => set({ recentDestinations: [] }),

      addSearch: (query) => {
        const clean = query.trim();
        if (clean.length < 2) return;
        set((state) => ({
          searches: [clean, ...state.searches.filter((item) => item !== clean)].slice(
            0,
            MAX_SEARCHES,
          ),
        }));
      },

      clearSearches: () => set({ searches: [] }),

      importLibrary: (data) =>
        set((state) => ({
          favorites: data.favorites ?? state.favorites,
          history: data.history ?? state.history,
          playlists: data.playlists ?? state.playlists,
        })),
    }),
    {
      name: "tecla-library-v1",
      version: 1,
      skipHydration: true,
    },
  ),
);

export function findFavorite(
  favorites: SavedFavorite[],
  kind: MediaKind,
  providerId: string,
): SavedFavorite | undefined {
  return favorites.find((item) => item.kind === kind && item.providerId === providerId);
}
