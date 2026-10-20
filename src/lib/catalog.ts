import {
  Clapperboard,
  Compass,
  Gamepad2,
  Map as MapIcon,
  Music2,
  Navigation,
  Podcast,
  Radio,
  Sparkles,
  Tv,
  TvMinimalPlay,
  type LucideIcon,
} from "lucide-react";

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  external?: boolean;
  icon: LucideIcon;
  gradient: string;
  accent: string;
  aiPrompt: string;
  category: "video" | "music" | "navigation" | "live" | "assistant";
}

export const APPS: AppDefinition[] = [
  {
    id: "youtube",
    name: "YouTube",
    description: "Videos, tendencias y canales",
    href: "/youtube",
    icon: TvMinimalPlay,
    gradient: "from-[#ff3b3b] via-[#c81e2b] to-[#4b0610]",
    accent: "#ff4d4d",
    aiPrompt: "busca un video en YouTube",
    category: "video",
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Música y listas",
    href: "/music",
    icon: Music2,
    gradient: "from-[#1ed760] via-[#118a45] to-[#063a20]",
    accent: "#1ed760",
    aiPrompt: "abre Spotify",
    category: "music",
  },
  {
    id: "waze",
    name: "Waze",
    description: "Rutas y tráfico",
    href: "/navigate?tab=waze",
    icon: Navigation,
    gradient: "from-[#37d6ff] via-[#1678c9] to-[#062c54]",
    accent: "#37d6ff",
    aiPrompt: "abre Waze y busca un destino",
    category: "navigation",
  },
  {
    id: "maps",
    name: "Google Maps",
    description: "Lugares y direcciones",
    href: "/navigate?tab=maps",
    icon: MapIcon,
    gradient: "from-[#5eead4] via-[#1c9c7a] to-[#053b30]",
    accent: "#5eead4",
    aiPrompt: "abre Google Maps",
    category: "navigation",
  },
  {
    id: "netflix",
    name: "Netflix",
    description: "Series y películas",
    href: "https://www.netflix.com",
    external: true,
    icon: Clapperboard,
    gradient: "from-[#f04343] via-[#890b0b] to-[#1c0303]",
    accent: "#f04343",
    aiPrompt: "abre Netflix",
    category: "video",
  },
  {
    id: "disney",
    name: "Disney+",
    description: "Historias para toda la familia",
    href: "https://www.disneyplus.com",
    external: true,
    icon: Sparkles,
    gradient: "from-[#6fa8ff] via-[#273a8f] to-[#080d2e]",
    accent: "#6fa8ff",
    aiPrompt: "abre Disney+",
    category: "video",
  },
  {
    id: "radio",
    name: "Radio",
    description: "Emisoras en vivo",
    href: "/radio",
    icon: Radio,
    gradient: "from-[#f6b756] via-[#a96011] to-[#3c1e02]",
    accent: "#f6b756",
    aiPrompt: "busca una emisora de vallenato",
    category: "live",
  },
  {
    id: "iptv",
    name: "IPTV",
    description: "Tus canales autorizados",
    href: "/iptv",
    icon: Tv,
    gradient: "from-[#b18cff] via-[#5b2bb0] to-[#1a0738]",
    accent: "#b18cff",
    aiPrompt: "abre IPTV",
    category: "live",
  },
  {
    id: "podcasts",
    name: "Podcasts",
    description: "Voces e historias",
    href: "/podcasts",
    icon: Podcast,
    gradient: "from-[#ff9a76] via-[#b53c52] to-[#390916]",
    accent: "#ff9a76",
    aiPrompt: "busca un podcast de inteligencia artificial",
    category: "music",
  },
  {
    id: "twitch",
    name: "Twitch",
    description: "Transmisiones en vivo",
    href: "/twitch",
    icon: Gamepad2,
    gradient: "from-[#a970ff] via-[#5c2bbf] to-[#1b0740]",
    accent: "#a970ff",
    aiPrompt: "abre Twitch",
    category: "live",
  },
  {
    id: "ai",
    name: "TECLA AI",
    description: "Tu copiloto de entretenimiento",
    href: "#tecla-ai",
    icon: Sparkles,
    gradient: "from-[#ff8a5c] via-[#ff4d3d] to-[#7c2ae8]",
    accent: "#ff6a4d",
    aiPrompt: "¿Qué me recomiendas ver hoy?",
    category: "assistant",
  },
];

export const APP_BY_ID = new Map(APPS.map((app) => [app.id, app]));

export const ALLOWED_APP_IDS = APPS.filter((app) => app.id !== "ai").map((app) => app.id);

export const ALLOWED_EXTERNAL_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "open.spotify.com",
  "waze.com",
  "www.waze.com",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "netflix.com",
  "www.netflix.com",
  "disneyplus.com",
  "www.disneyplus.com",
  "twitch.tv",
  "www.twitch.tv",
  "radio-browser.info",
  "www.radio-browser.info",
] as const;

export const DASHBOARD_SECTIONS = [
  { id: "continue", label: "Continuar viendo" },
  { id: "trending", label: "Tendencias en Colombia" },
  { id: "recommended", label: "Recomendados" },
  { id: "favorites", label: "Favoritos" },
  { id: "music", label: "Música" },
  { id: "lists", label: "Mis listas" },
  { id: "apps", label: "Aplicaciones" },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

export const QUICK_ACCESS_IDS = [
  "youtube",
  "spotify",
  "waze",
  "maps",
  "netflix",
  "disney",
  "radio",
  "iptv",
  "podcasts",
  "twitch",
  "ai",
] as const;

export const EXPLORER_LINKS = [
  { href: "/youtube", label: "YouTube", icon: TvMinimalPlay },
  { href: "/music", label: "Música", icon: Music2 },
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/podcasts", label: "Podcasts", icon: Podcast },
  { href: "/iptv", label: "IPTV", icon: Tv },
  { href: "/navigate", label: "Navegar", icon: Compass },
];
