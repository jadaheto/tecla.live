/**
 * Catálogo y utilidades puras de TECLA DRIVE.
 *
 * Todo el contenido (escenas, motores y nombres) es original de TECLA LIVE.
 * Los motores se describen por su arquitectura (V8, bóxer, rotativo, EV…),
 * no por marcas ni modelos comerciales.
 */

export const MAX_SPEED = 240; // km/h visibles en el velocímetro
export const LAUNCH_TARGET_SPEED = 100; // km/h de la arrancada 0–100
export const KMH_PER_MPH = 1.60934;

export type DriveSceneId =
  | "halloween"
  | "neon"
  | "canyon"
  | "coast"
  | "alpine"
  | "aurora"
  | "galaxy"
  | "stars"
  | "plaid"
  | "portal"
  | "christmas"
  | "rainy_city"
  | "city_day";

export interface DriveScene {
  id: DriveSceneId;
  label: string;
  subtitle: string;
  accent: string;
  swatch: string;
  night: boolean;
}

export const DRIVE_SCENES: readonly DriveScene[] = [
  {
    id: "halloween",
    label: "Halloween",
    subtitle: "Castillo, calabazas, fantasmas y relámpagos sobre la carretera.",
    accent: "#fb923c",
    swatch: "from-[#24153d] via-[#4a2a6a] to-[#07050c]",
    night: true,
  },
  {
    id: "neon",
    label: "Neón",
    subtitle: "Ciudad synthwave con sol de rejilla y palmeras de luz.",
    accent: "#ff2ea6",
    swatch: "from-[#2a0a4e] via-[#ff2a7f] to-[#060212]",
    night: true,
  },
  {
    id: "canyon",
    label: "Cañón",
    subtitle: "Atardecer de desierto, mesetas, cactus y calor sobre el asfalto.",
    accent: "#f59e0b",
    swatch: "from-[#9a3412] via-[#f59e0b] to-[#1e0a08]",
    night: false,
  },
  {
    id: "coast",
    label: "Costa",
    subtitle: "Mar en movimiento, faro, veleros y palmeras junto a la vía.",
    accent: "#fbbf24",
    swatch: "from-[#1e3a8a] via-[#f97316] to-[#082f49]",
    night: false,
  },
  {
    id: "alpine",
    label: "Alpes",
    subtitle: "Pinos nevados, cabañas y niebla fría en la montaña.",
    accent: "#38bdf8",
    swatch: "from-[#1d4e89] via-[#bfe3f8] to-[#2b4a6f]",
    night: false,
  },
  {
    id: "aurora",
    label: "Aurora",
    subtitle: "Bosque nocturno bajo cortinas de luz verde y violeta.",
    accent: "#2dd4bf",
    swatch: "from-[#020617] via-[#10b981] to-[#083344]",
    night: true,
  },
  {
    id: "galaxy",
    label: "Galaxia",
    subtitle: "Nebulosas, una espiral girando y cristales flotantes.",
    accent: "#e879f9",
    swatch: "from-[#140a2a] via-[#a78bfa] to-[#04020c]",
    night: true,
  },
  {
    id: "stars",
    label: "Estrellas",
    subtitle: "Salto a velocidad luz entre un campo de estrellas.",
    accent: "#93c5fd",
    swatch: "from-[#03050a] via-[#1e3a8a] to-[#03050a]",
    night: true,
  },
  {
    id: "plaid",
    label: "Plaid",
    subtitle: "Túnel de luz arcoíris que se acelera contigo.",
    accent: "#38bdf8",
    swatch: "from-[#f43f5e] via-[#38bdf8] to-[#a855f7]",
    night: true,
  },
  {
    id: "portal",
    label: "Portal",
    subtitle: "Anillos de energía naranja y cian que cruzas sin parar.",
    accent: "#f97316",
    swatch: "from-[#0f0720] via-[#f97316] to-[#00e5ff]",
    night: true,
  },
  {
    id: "christmas",
    label: "Navidad",
    subtitle: "Pueblo nevado, cabañas encendidas y luces cálidas en la vía.",
    accent: "#f87171",
    swatch: "from-[#0b1a33] via-[#f87171] to-[#fef3c7]",
    night: true,
  },
  {
    id: "rainy_city",
    label: "Ciudad lluviosa",
    subtitle: "Noche de lluvia, asfalto mojado y ventanas encendidas.",
    accent: "#60a5fa",
    swatch: "from-[#020617] via-[#1e3a8a] to-[#60a5fa]",
    night: true,
  },
  {
    id: "city_day",
    label: "Ciudad de día",
    subtitle: "Avenida despejada con edificios, nubes y aves.",
    accent: "#0ea5e9",
    swatch: "from-[#bae6fd] via-[#0ea5e9] to-[#334155]",
    night: false,
  },
];

export type EngineType =
  | "v8_cross"
  | "v8_flat"
  | "v10_v12"
  | "rotary"
  | "boxer"
  | "inline6"
  | "supercharged"
  | "i4_race"
  | "ev"
  | "hover"
  | "scifi"
  | "spooky";

export type EngineCategory = "supercar" | "muscle" | "turbo" | "ev";

export interface DriveEngine {
  id: string;
  name: string;
  sub: string;
  description: string;
  category: EngineCategory;
  engineType: EngineType;
  idle: number;
  redline: number;
  cylinders: number;
  pitch: number;
  resonators: readonly [number, number, number];
  turbo: number;
  supercharger: number;
  crackle: number;
  flutter: boolean;
}

export const ENGINE_CATEGORIES: readonly { id: EngineCategory | "all" | "fav"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "supercar", label: "Exóticos V10/V12" },
  { id: "muscle", label: "V8 y compresor" },
  { id: "turbo", label: "Turbo, rotativo, rally" },
  { id: "ev", label: "EV, sci-fi y terror" },
  { id: "fav", label: "★ Favoritos" },
];

export const DRIVE_ENGINES: readonly DriveEngine[] = [
  {
    id: "v8_biturbo",
    name: "V8 Biturbo",
    sub: "4.0 L biturbo",
    description: "Gruñido profundo con petardeos al soltar y silbido de wastegate.",
    category: "muscle",
    engineType: "v8_cross",
    idle: 780,
    redline: 7200,
    cylinders: 8,
    pitch: 1,
    resonators: [140, 420, 1100],
    turbo: 1,
    supercharger: 0,
    crackle: 6,
    flutter: false,
  },
  {
    id: "v8_plano",
    name: "V8 Plano 9000",
    sub: "4.5 L atmosférico, cigüeñal plano",
    description: "Aullido de competición hasta 9000 rpm con ladrido en las reducciones.",
    category: "supercar",
    engineType: "v8_flat",
    idle: 1050,
    redline: 9000,
    cylinders: 8,
    pitch: 1.42,
    resonators: [280, 920, 2400],
    turbo: 0,
    supercharger: 0,
    crackle: 4,
    flutter: false,
  },
  {
    id: "v8_biturbo_sport",
    name: "V8 Biturbo Sport",
    sub: "4.4 L biturbo, escape deportivo",
    description: "Medios metálicos y disparos fuertes al levantar el pie.",
    category: "muscle",
    engineType: "v8_cross",
    idle: 820,
    redline: 7300,
    cylinders: 8,
    pitch: 1.08,
    resonators: [165, 510, 1350],
    turbo: 0.85,
    supercharger: 0,
    crackle: 9,
    flutter: false,
  },
  {
    id: "v8_compresor_62",
    name: "V8 Compresor 6.2",
    sub: "Twin-screw sobre V8 de 6.2 L",
    description: "Silbido de compresor sobre un rugido brutal de ocho cilindros.",
    category: "muscle",
    engineType: "supercharged",
    idle: 740,
    redline: 6500,
    cylinders: 8,
    pitch: 0.9,
    resonators: [125, 380, 950],
    turbo: 0,
    supercharger: 1.6,
    crackle: 4,
    flutter: false,
  },
  {
    id: "rotativo_turbo",
    name: "Rotativo Turbo",
    sub: "Birrotor de admisión abierta",
    description: "Brap-brap en ralentí que se convierte en un enjambre a 9000 rpm.",
    category: "turbo",
    engineType: "rotary",
    idle: 1100,
    redline: 9000,
    cylinders: 6,
    pitch: 1.35,
    resonators: [320, 880, 2100],
    turbo: 1.1,
    supercharger: 0,
    crackle: 5,
    flutter: true,
  },
  {
    id: "seis_linea_turbo",
    name: "6 en línea Turbo",
    sub: "3.0 L con turbo grande",
    description: "Aullido sedoso de seis cilindros con spool masivo y flutter.",
    category: "turbo",
    engineType: "inline6",
    idle: 850,
    redline: 8200,
    cylinders: 6,
    pitch: 1.15,
    resonators: [210, 640, 1800],
    turbo: 1.45,
    supercharger: 0,
    crackle: 6,
    flutter: true,
  },
  {
    id: "boxer_rally",
    name: "Bóxer Rally",
    sub: "Flat-4 con colectores desiguales",
    description: "Latido grave de rally con antilag stu-tu-tu al soltar.",
    category: "turbo",
    engineType: "boxer",
    idle: 850,
    redline: 7200,
    cylinders: 4,
    pitch: 0.95,
    resonators: [130, 340, 890],
    turbo: 1.1,
    supercharger: 0,
    crackle: 7,
    flutter: true,
  },
  {
    id: "v12_pista",
    name: "V12 Pista",
    sub: "6.3 L atmosférico, 9200 rpm",
    description: "Sinfonía de doce cilindros sin filtro hasta el corte.",
    category: "supercar",
    engineType: "v10_v12",
    idle: 1150,
    redline: 9200,
    cylinders: 12,
    pitch: 1.65,
    resonators: [380, 1250, 3200],
    turbo: 0,
    supercharger: 0.25,
    crackle: 4,
    flutter: false,
  },
  {
    id: "v10_sport",
    name: "V10 Sport",
    sub: "5.2 L atmosférico",
    description: "Aullido de diez cilindros con armónico de quinto orden.",
    category: "supercar",
    engineType: "v10_v12",
    idle: 1000,
    redline: 8700,
    cylinders: 10,
    pitch: 1.48,
    resonators: [310, 1080, 2750],
    turbo: 0,
    supercharger: 0,
    crackle: 5,
    flutter: false,
  },
  {
    id: "v8_pushrod",
    name: "V8 Pushrod 6.2",
    sub: "Varillas y árbol de levas agresivo",
    description: "Trueno americano con cabeceo de leva y ladrido de cuatro salidas.",
    category: "muscle",
    engineType: "v8_cross",
    idle: 720,
    redline: 6600,
    cylinders: 8,
    pitch: 0.88,
    resonators: [120, 360, 980],
    turbo: 0,
    supercharger: 0.45,
    crackle: 5,
    flutter: false,
  },
  {
    id: "v8_pushrod_compresor",
    name: "V8 Pushrod Compresor",
    sub: "Polea corta, 1000 hp",
    description: "Compresor ensordecedor y cabeceo violento de leva de pista.",
    category: "muscle",
    engineType: "supercharged",
    idle: 760,
    redline: 6800,
    cylinders: 8,
    pitch: 0.92,
    resonators: [130, 410, 1050],
    turbo: 0,
    supercharger: 1.85,
    crackle: 6,
    flutter: false,
  },
  {
    id: "v8_compresor_52",
    name: "V8 Compresor 5.2",
    sub: "Cigüeñal cruzado con compresor",
    description: "Escape rasposo doble con silbido de compresor de alta velocidad.",
    category: "muscle",
    engineType: "supercharged",
    idle: 800,
    redline: 7500,
    cylinders: 8,
    pitch: 1.02,
    resonators: [155, 480, 1280],
    turbo: 0,
    supercharger: 1.25,
    crackle: 6,
    flutter: false,
  },
  {
    id: "seis_linea_itb",
    name: "6 en línea ITB",
    sub: "3.5 L de carreras clásicas",
    description: "Admisión con cuerpos individuales y ladrido mecánico vintage.",
    category: "supercar",
    engineType: "inline6",
    idle: 1050,
    redline: 8500,
    cylinders: 6,
    pitch: 1.28,
    resonators: [260, 790, 2150],
    turbo: 0,
    supercharger: 0,
    crackle: 5,
    flutter: false,
  },
  {
    id: "cuatro_formula",
    name: "4 cil. Fórmula",
    sub: "Monoplaza, 8800 rpm",
    description: "Grito de cuatro cilindros de fórmula con caja de dientes rectos.",
    category: "supercar",
    engineType: "i4_race",
    idle: 1150,
    redline: 8800,
    cylinders: 4,
    pitch: 1.22,
    resonators: [240, 720, 1950],
    turbo: 0,
    supercharger: 0.75,
    crackle: 4,
    flutter: false,
  },
  {
    id: "v6_hot_v",
    name: "V6 Hot-V",
    sub: "120°, biturbo, 8500 rpm",
    description: "Chillido armónico de «pequeño V12» desde un V6 biturbo.",
    category: "supercar",
    engineType: "v10_v12",
    idle: 920,
    redline: 8500,
    cylinders: 6,
    pitch: 1.32,
    resonators: [270, 860, 2250],
    turbo: 0.75,
    supercharger: 0,
    crackle: 4,
    flutter: false,
  },
  {
    id: "v6_biturbo",
    name: "V6 Biturbo",
    sub: "3.8 L, escape de titanio",
    description: "Empuje mecánico biturbo con resonancia hueca y siseo de descarga.",
    category: "turbo",
    engineType: "inline6",
    idle: 850,
    redline: 7200,
    cylinders: 6,
    pitch: 1.05,
    resonators: [190, 560, 1550],
    turbo: 1.25,
    supercharger: 0,
    crackle: 6,
    flutter: false,
  },
  {
    id: "v8_gt3",
    name: "V8 GT3",
    sub: "6.2 L de resistencia",
    description: "Bajo atronador de salida lateral y silbido de transmisión de carreras.",
    category: "supercar",
    engineType: "v8_cross",
    idle: 900,
    redline: 7500,
    cylinders: 8,
    pitch: 0.94,
    resonators: [135, 390, 1120],
    turbo: 0,
    supercharger: 0.65,
    crackle: 7,
    flutter: false,
  },
  {
    id: "v8_big_block",
    name: "V8 Big-Block",
    sub: "7.0 L clásico",
    description: "Ralentí pesado y cabeceante con retumbo de escape de los años 60.",
    category: "muscle",
    engineType: "v8_cross",
    idle: 680,
    redline: 5800,
    cylinders: 8,
    pitch: 0.78,
    resonators: [105, 290, 760],
    turbo: 0,
    supercharger: 0,
    crackle: 3,
    flutter: false,
  },
  {
    id: "v8_sport",
    name: "V8 Sport",
    sub: "4.0 L moderno, válvulas abiertas",
    description: "Refinado pero musculoso, con cuatro salidas activas.",
    category: "muscle",
    engineType: "v8_cross",
    idle: 800,
    redline: 7300,
    cylinders: 8,
    pitch: 1,
    resonators: [150, 440, 1180],
    turbo: 0.5,
    supercharger: 0,
    crackle: 5,
    flutter: false,
  },
  {
    id: "ev_trimotor",
    name: "EV Trimotor",
    sub: "Rotores de carbono, 1000 hp",
    description: "Silbido de tres motores con oleada de par de alto voltaje.",
    category: "ev",
    engineType: "ev",
    idle: 0,
    redline: 18000,
    cylinders: 0,
    pitch: 1.3,
    resonators: [600, 1800, 4200],
    turbo: 0,
    supercharger: 0.9,
    crackle: 0,
    flutter: false,
  },
  {
    id: "ev_inverter",
    name: "EV Inverter",
    sub: "Zumbido de doble inversor",
    description: "Oleada armónica limpia que sube con la velocidad.",
    category: "ev",
    engineType: "ev",
    idle: 0,
    redline: 12000,
    cylinders: 0,
    pitch: 1,
    resonators: [400, 1200, 3000],
    turbo: 0,
    supercharger: 0.35,
    crackle: 0,
    flutter: false,
  },
  {
    id: "hover",
    name: "Hover",
    sub: "Levitación magnética",
    description: "Turbina magnética con subgraves que respiran.",
    category: "ev",
    engineType: "hover",
    idle: 500,
    redline: 6500,
    cylinders: 0,
    pitch: 0.9,
    resonators: [140, 420, 1100],
    turbo: 0.4,
    supercharger: 0,
    crackle: 0,
    flutter: false,
  },
  {
    id: "warp",
    name: "Warp",
    sub: "Núcleo de hiperimpulso",
    description: "Núcleo de salto estelar con subida de tono por FM.",
    category: "ev",
    engineType: "scifi",
    idle: 500,
    redline: 8500,
    cylinders: 0,
    pitch: 1.15,
    resonators: [280, 950, 2600],
    turbo: 0.3,
    supercharger: 0.4,
    crackle: 0,
    flutter: false,
  },
  {
    id: "crucero_estelar",
    name: "Crucero Estelar",
    sub: "Reactor de crucero interestelar",
    description: "Subgraves de reactor con resonancia de propulsores iónicos.",
    category: "ev",
    engineType: "hover",
    idle: 450,
    redline: 7000,
    cylinders: 0,
    pitch: 0.75,
    resonators: [110, 320, 880],
    turbo: 0.5,
    supercharger: 0,
    crackle: 0,
    flutter: false,
  },
  {
    id: "fantasma",
    name: "Fantasma",
    sub: "Conducción espectral",
    description: "Theremín fantasmal, órgano embrujado y truenos al soltar.",
    category: "ev",
    engineType: "spooky",
    idle: 666,
    redline: 6666,
    cylinders: 0,
    pitch: 1,
    resonators: [300, 880, 2200],
    turbo: 0.4,
    supercharger: 0,
    crackle: 6,
    flutter: false,
  },
  {
    id: "cyber",
    name: "Cyber",
    sub: "Propulsión cuántica",
    description: "Doble oscilador cyberpunk con sobretonos cristalinos.",
    category: "ev",
    engineType: "scifi",
    idle: 400,
    redline: 10000,
    cylinders: 0,
    pitch: 1.35,
    resonators: [380, 1300, 3400],
    turbo: 0.25,
    supercharger: 0.5,
    crackle: 0,
    flutter: false,
  },
];

export const DEFAULT_ENGINE_ID = "v8_biturbo";
export const DEFAULT_SCENE_ID: DriveSceneId = "halloween";
export const DEFAULT_FAVORITES: readonly string[] = [
  "v8_biturbo",
  "v8_plano",
  "v8_compresor_62",
  "rotativo_turbo",
  "boxer_rally",
  "v12_pista",
];

export interface StudioSettings {
  turbo: number;
  crackles: number;
  tone: number;
  pitch: number;
  lope: number;
}

export const DEFAULT_STUDIO: StudioSettings = {
  turbo: 1,
  crackles: 1,
  tone: 1,
  pitch: 1,
  lope: 1,
};

export const STUDIO_SLIDERS: readonly {
  key: keyof StudioSettings;
  label: string;
  min: number;
  max: number;
  format: "percent" | "factor";
}[] = [
  { key: "turbo", label: "Turbo / compresor", min: 0, max: 250, format: "percent" },
  { key: "crackles", label: "Petardeos en el escape", min: 0, max: 250, format: "percent" },
  { key: "tone", label: "Resonancia (grave ↔ rasposo)", min: 50, max: 200, format: "percent" },
  { key: "pitch", label: "Tono del motor", min: 70, max: 140, format: "factor" },
  { key: "lope", label: "Cabeceo en ralentí", min: 0, max: 250, format: "percent" },
];

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SPEED, Math.max(0, value));
}

export function speedRatio(speed: number): number {
  return clampSpeed(speed) / MAX_SPEED;
}

export function kmhToMph(kmh: number): number {
  return kmh / KMH_PER_MPH;
}

export function formatSpeed(speedKmh: number, useKmh = true): string {
  const value = useKmh ? clampSpeed(speedKmh) : kmhToMph(clampSpeed(speedKmh));
  return String(Math.round(value));
}

export function findEngine(id: string): DriveEngine {
  return DRIVE_ENGINES.find((engine) => engine.id === id) ?? DRIVE_ENGINES[0]!;
}

export function findScene(id: string): DriveScene {
  return DRIVE_SCENES.find((scene) => scene.id === id) ?? DRIVE_SCENES[0]!;
}

export function isSceneId(value: string): value is DriveSceneId {
  return DRIVE_SCENES.some((scene) => scene.id === value);
}

export function filterEngines(
  category: EngineCategory | "all" | "fav",
  favorites: readonly string[],
): DriveEngine[] {
  if (category === "all") return [...DRIVE_ENGINES];
  if (category === "fav") return DRIVE_ENGINES.filter((engine) => favorites.includes(engine.id));
  return DRIVE_ENGINES.filter((engine) => engine.category === category);
}

/** Posición normalizada de las rpm entre ralentí y corte (0–1). */
export function rpmNorm(engine: Pick<DriveEngine, "idle" | "redline">, rpm: number): number {
  const span = Math.max(1, engine.redline - engine.idle);
  return Math.max(0, Math.min(1, (rpm - engine.idle) / span));
}

/** Segundos detenido tras los cuales el motor baja a un ralentí suave. */
export const PARKED_AFTER_SECONDS = 120;
/** Segundos sin tocar la pantalla tras los cuales el HUD se oculta. */
export const HUD_HIDE_AFTER_SECONDS = 6;

export type WeatherGroup = "clear" | "clouds" | "fog" | "drizzle" | "rain" | "snow" | "storm" | "unknown";

/**
 * Elige una escena según la hora local y el clima real. Determinista y sin
 * efectos: la interfaz decide cuándo aplicarla.
 */
export function pickAutoScene(input: {
  hour: number;
  month: number;
  weather: WeatherGroup | null;
}): DriveSceneId {
  const { hour, month, weather } = input;
  const night = hour >= 19 || hour < 6;
  const dusk = hour >= 17 && hour < 19;
  const octoberNight = month === 10 && night;
  const decemberNight = month === 12 && night;
  if (weather === "storm") return night ? "halloween" : "canyon";
  if (weather === "snow") return night ? "christmas" : "alpine";
  if (weather === "fog") return night ? "aurora" : "alpine";
  if (weather === "rain" || weather === "drizzle") return night ? "rainy_city" : "alpine";
  if (octoberNight) return "halloween";
  if (decemberNight) return "christmas";
  if (night) return hour >= 23 || hour < 4 ? "galaxy" : "aurora";
  if (dusk) return "neon";
  if (hour < 12) return "coast";
  return weather === "clouds" ? "city_day" : "canyon";
}

export function isTeslaBrowser(userAgent: string): boolean {
  return /Tesla\//i.test(userAgent) || /QtCarBrowser/i.test(userAgent);
}
