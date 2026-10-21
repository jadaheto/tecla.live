export type ThemeMode = "light" | "dark" | "auto";
export type DisplayMode = "normal" | "cinema" | "kiosk";
export type ResolvedTheme = "light" | "dark";
export type VisualStyle = "tecla" | "cyberpunk" | "kitt";
export type AiPersona = "copiloto" | "jarvis";

export type MediaKind =
  | "youtube"
  | "radio"
  | "podcast"
  | "channel"
  | "playlist"
  | "iptv"
  | "app"
  | "destination";

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  href?: string;
  providerId?: string;
  durationSeconds?: number;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnail: string;
  durationSeconds?: number;
  liveBroadcastContent?: "none" | "live" | "upcoming";
  embeddable?: boolean;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  query: string;
  configured: boolean;
  cached?: boolean;
}

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  language?: string;
  tags?: string[];
  bitrate?: number;
  isHls?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  podcastTitle: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  durationSeconds?: number;
  publishedAt?: string;
  feedUrl?: string;
  externalUrl?: string;
}

export interface WeatherSnapshot {
  location: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  isDay: boolean;
  code: number;
  label: string;
  updatedAt: string;
}

export interface HistoryEntry {
  kind: MediaKind;
  providerId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  href?: string;
  positionSeconds: number;
  durationSeconds: number;
  lastWatchedAt: string;
}

export interface SavedFavorite {
  kind: MediaKind;
  providerId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  href?: string;
  addedAt: string;
}

export interface SavedDestination {
  id: string;
  label: string;
  address: string;
  kind: "home" | "work" | "custom";
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  items: SavedFavorite[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerItem {
  kind: "youtube" | "radio" | "podcast" | "iptv" | "spotify";
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  audioUrl?: string;
  href?: string;
  durationSeconds?: number;
  positionSeconds?: number;
}

export type AiVisualState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "executing"
  | "speaking"
  | "error";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: Array<{ name: string; status: "ok" | "error"; summary: string }>;
}

export interface AiUiContext {
  pathname: string;
  screen: string;
  selectedTitle?: string;
  selectedKind?: string;
  player?: {
    kind?: string;
    title?: string;
    isPlaying?: boolean;
    positionSeconds?: number;
    durationSeconds?: number;
  };
  capabilities?: {
    microphone?: boolean;
    fullscreen?: boolean;
    autoplay?: boolean;
    webSpeech?: boolean;
  };
  timezone: string;
  locale: string;
}
