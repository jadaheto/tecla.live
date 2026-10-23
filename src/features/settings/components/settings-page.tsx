"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Accessibility,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Database,
  Download,
  ExternalLink,
  Expand,
  KeyRound,
  ListOrdered,
  MapPin,
  Mic,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
  Volume2,
  Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  SettingRow,
  SettingsSection,
  Segmented,
  StatusDot,
} from "@/features/settings/components/settings-ui";
import { AccountSection } from "@/features/settings/components/account-section";
import { useIntegrations } from "@/features/integrations/hooks";
import { usePreferences } from "@/stores/preferences";
import { useLibrary } from "@/stores/library";
import { useAi } from "@/features/ai/store";
import { useAiMemory } from "@/stores/ai-memory";
import { DASHBOARD_SECTIONS, type DashboardSectionId } from "@/lib/catalog";
import { apiFetch, errorMessage } from "@/lib/http";
import { toast } from "@/stores/toast";
import type { AiPersona, DisplayMode, ThemeMode, VisualStyle } from "@/types";

interface MeResponse {
  user: { id: string; email: string; name: string | null } | null;
  accountsAvailable: boolean;
}

interface VoiceOption {
  id: string;
  name: string;
  category?: string;
  labels?: Record<string, string | number>;
}

interface VoicesResponse {
  voices: VoiceOption[];
  defaultVoiceId: string | null;
  defaultVoiceName?: string | null;
  curated?: Array<{ id: string; name: string; group: "latino" | "hombres" | "mujeres"; description: string }>;
  groups?: Record<"latino" | "hombres" | "mujeres", string>;
}

interface PlaceResponse {
  place: { lat: number; lon: number; label: string };
}

const SECTION_LABELS = new Map(
  DASHBOARD_SECTIONS.map((section) => [section.id, section.label]),
);

export function SettingsPage() {
  const preferences = usePreferences();
  const setPreferences = usePreferences((state) => state.setPreferences);
  const moveSection = usePreferences((state) => state.moveSection);
  const integrations = useIntegrations();
  const favorites = useLibrary((state) => state.favorites);
  const history = useLibrary((state) => state.history);
  const playlists = useLibrary((state) => state.playlists);
  const destinations = useLibrary((state) => state.destinations);
  const weatherLocation = usePreferences((state) => state.weatherLocation);
  const [locationQuery, setLocationQuery] = React.useState("");
  const [foundPlace, setFoundPlace] = React.useState<PlaceResponse["place"] | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [confirmWipe, setConfirmWipe] = React.useState(false);
  const [testingFullscreen, setTestingFullscreen] = React.useState(false);
  const memoryEntries = useAiMemory((state) => state.entries);
  const removeMemory = useAiMemory((state) => state.remove);
  const clearMemory = useAiMemory((state) => state.clear);

  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    staleTime: 60_000,
  });

  const publicVoices = useQuery({
    queryKey: ["ai-voices-public"],
    queryFn: () => apiFetch<VoicesResponse>("/api/ai/voices/public"),
    enabled: Boolean(integrations.data?.integrations.elevenlabs),
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const voices = useQuery({
    queryKey: ["ai-voices"],
    queryFn: () => apiFetch<VoicesResponse>("/api/ai/voices"),
    enabled: Boolean(me.data?.user) && Boolean(integrations.data?.integrations.elevenlabs),
    staleTime: 10 * 60_000,
    retry: 0,
  });

  const status = integrations.data;
  const deepgramReady = status?.integrations.deepgram ?? false;
  const elevenLabsReady = status?.integrations.elevenlabs ?? false;

  async function locate(event: React.FormEvent) {
    event.preventDefault();
    const query = locationQuery.trim();
    if (query.length < 2) return;
    setLocating(true);
    setFoundPlace(null);
    try {
      const data = await apiFetch<PlaceResponse>(`/api/geocode?q=${encodeURIComponent(query)}`);
      setFoundPlace(data.place);
    } catch (error) {
      toast({ title: "No encontramos el lugar", description: errorMessage(error), variant: "error" });
    } finally {
      setLocating(false);
    }
  }

  function savePlace() {
    if (!foundPlace) return;
    setPreferences({
      weatherLocation: foundPlace.label,
      weatherLat: foundPlace.lat,
      weatherLon: foundPlace.lon,
    });
    setFoundPlace(null);
    setLocationQuery("");
    toast({
      title: "Ubicación actualizada",
      description: `${foundPlace.label} (${foundPlace.lat.toFixed(2)}, ${foundPlace.lon.toFixed(2)})`,
      variant: "success",
    });
  }

  async function testFullscreen() {
    setTestingFullscreen(true);
    try {
      if (!document.fullscreenEnabled) {
        toast({
          title: "Pantalla completa no disponible",
          description: "Este navegador no permite pantalla completa para la página.",
          variant: "info",
        });
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      toast({
        title: "El navegador bloqueó la pantalla completa",
        description: "Debe activarse desde un toque directo y con compatibilidad del navegador.",
        variant: "error",
      });
    } finally {
      setTestingFullscreen(false);
    }
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "TECLA LIVE",
      preferences: {
        theme: preferences.theme,
        displayMode: preferences.displayMode,
        autoThemeEnabled: preferences.autoThemeEnabled,
        autoThemeStart: preferences.autoThemeStart,
        autoThemeEnd: preferences.autoThemeEnd,
        reduceMotion: preferences.reduceMotion,
        voiceEnabled: preferences.voiceEnabled,
        conversationMode: preferences.conversationMode,
        volume: preferences.volume,
        weatherLocation: preferences.weatherLocation,
        weatherLat: preferences.weatherLat,
        weatherLon: preferences.weatherLon,
        dashboardOrder: preferences.dashboardOrder,
      },
      library: { favorites, history, playlists, destinations },
      aiMemory: memoryEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tecla-live-datos.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "Datos exportados", description: "Se descargó un archivo JSON.", variant: "success" });
  }

  function wipeLocalData() {
    useAi.getState().clearConversation();
    useLibrary.getState().clearHistory();
    useLibrary.getState().clearFavorites();
    useLibrary.getState().clearPlaylists();
    useLibrary.getState().clearDestinations();
    useLibrary.getState().clearSearches();
    useAiMemory.getState().clear();
    usePreferences.getState().resetPreferences();
    try {
      localStorage.removeItem("tecla-preferences-v1");
      localStorage.removeItem("tecla-library-v1");
      localStorage.removeItem("tecla-ai-memory-v1");
    } catch {
      // Almacenamiento no disponible.
    }
    window.location.reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Preferencias"
        title="Ajustes"
        description="Todo se guarda en este navegador. Tú controlas el tema, la voz, el clima y los datos."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void testFullscreen()} loading={testingFullscreen}>
              <Expand className="size-4" aria-hidden />
              Probar pantalla completa
            </Button>
            <Link
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              <Server className="size-3.5" aria-hidden />
              Estado del sistema
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SettingsSection
            id="apariencia"
            icon={Palette}
            title="Apariencia"
            description="Identidad visual de TECLA LIVE."
          >
            <SettingRow
              title="Tema"
              description="El modo automático cambia entre claro y oscuro según el horario nocturno."
            >
              <Segmented<ThemeMode>
                ariaLabel="Tema de la aplicación"
                value={preferences.theme}
                onChange={(theme) => setPreferences({ theme })}
                options={[
                  { value: "light", label: "Claro", icon: Sun },
                  { value: "dark", label: "Oscuro", icon: Moon },
                  { value: "auto", label: "Automático", icon: SunMoon },
                ]}
              />
            </SettingRow>

            {preferences.theme === "auto" ? (
              <>
                <SettingRow
                  title="Usar horario nocturno"
                  description="Si se desactiva, el modo automático mantiene el tema oscuro."
                >
                  <Switch
                    checked={preferences.autoThemeEnabled}
                    onCheckedChange={(checked) => setPreferences({ autoThemeEnabled: checked })}
                    aria-label="Usar horario nocturno"
                  />
                </SettingRow>
                <SettingRow
                  title="Horario nocturno"
                  description="Desde esta hora se usa el tema oscuro; al terminar, el claro."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={preferences.autoThemeStart}
                      onChange={(event) =>
                        setPreferences({ autoThemeStart: event.target.value || "18:30" })
                      }
                      aria-label="Inicio del horario nocturno"
                      className="h-10 w-[116px] px-2 text-center font-mono text-xs"
                      disabled={!preferences.autoThemeEnabled}
                    />
                    <span className="text-[11px] text-muted">a</span>
                    <Input
                      type="time"
                      value={preferences.autoThemeEnd}
                      onChange={(event) =>
                        setPreferences({ autoThemeEnd: event.target.value || "06:30" })
                      }
                      aria-label="Fin del horario nocturno"
                      className="h-10 w-[116px] px-2 text-center font-mono text-xs"
                      disabled={!preferences.autoThemeEnabled}
                    />
                  </div>
                </SettingRow>
              </>
            ) : null}

            <SettingRow
              title="Estilo visual"
              description="Cyberpunk 2077: tipografía Rajdhani, neón amarillo y cian, scanlines. El auto fantástico: negro, escáner rojo de KITT, ámbar, tipografía Orbitron; activa la personalidad y la voz grave de KITT. Roadster: cabina de caza en rojo monocromo sobre negro, rejilla de puntos y retícula de radar; activa la personalidad de copiloto de vuelo. Todos fuerzan el tema oscuro."
            >
              <Segmented<VisualStyle>
                ariaLabel="Estilo visual"
                value={preferences.visualStyle}
                onChange={(visualStyle) => setPreferences({ visualStyle })}
                options={[
                  { value: "tecla", label: "TECLA" },
                  { value: "cyberpunk", label: "Cyberpunk 2077" },
                  { value: "kitt", label: "El auto fantástico" },
                  { value: "roadster", label: "Roadster" },
                ]}
              />
            </SettingRow>

            <SettingRow
              title="Fondo ambiental"
              description="Resplandores y textura sutil. Desactívalo para un fondo más plano."
            >
              <Switch
                checked={preferences.ambientBackground}
                onCheckedChange={(checked) => setPreferences({ ambientBackground: checked })}
                aria-label="Fondo ambiental"
              />
            </SettingRow>
            <SettingRow
              title="Reducir animaciones"
              description="Recomendado si notas movimiento pesado en el vehículo. También respeta la preferencia del sistema."
            >
              <Switch
                checked={preferences.reduceMotion}
                onCheckedChange={(checked) => setPreferences({ reduceMotion: checked })}
                aria-label="Reducir animaciones"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            id="pantalla"
            icon={Monitor}
            title="Pantalla"
            description="Modos pensados para el Tesla y pantallas horizontales."
          >
            <SettingRow
              title="Modo de visualización"
              description="Cine oculta la cabecera. Kiosco oculta la navegación para uso pasivo."
              className="flex-col items-start"
            >
              <Segmented<DisplayMode>
                ariaLabel="Modo de visualización"
                value={preferences.displayMode}
                onChange={(displayMode) => {
                  setPreferences({ displayMode });
                  if (displayMode !== "normal") {
                    toast({
                      title: displayMode === "cinema" ? "Modo cine activo" : "Modo kiosco activo",
                      description: "Usa «Salir de modo» en la esquina superior derecha.",
                      variant: "info",
                    });
                  }
                }}
                options={[
                  { value: "normal", label: "Normal", icon: Monitor },
                  { value: "cinema", label: "Cine", icon: Sparkles },
                  { value: "kiosk", label: "Kiosco", icon: Accessibility },
                ]}
              />
            </SettingRow>
            <SettingRow
              title="Modo de pantalla completa"
              description="El navegador puede bloquearlo dentro del Tesla. Siempre hay un fallback táctil."
            >
              <Button variant="glass" size="sm" onClick={() => void testFullscreen()}>
                <Expand className="size-3.5" aria-hidden />
                Probar ahora
              </Button>
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            id="ia"
            icon={Sparkles}
            title="TECLA AI"
            description="Voz, conversación y memoria opcional."
          >
            <SettingRow
              title="Nombre del asistente"
              description="Cómo lo llamas: «TECLA», «Jarvis», el que prefieras. Se usa en las respuestas, en el panel y en «Oye <nombre>»."
            >
              <Input
                value={preferences.aiName}
                maxLength={24}
                onChange={(event) => setPreferences({ aiName: event.target.value.slice(0, 24) })}
                onBlur={(event) => {
                  if (!event.target.value.trim()) setPreferences({ aiName: "TECLA" });
                }}
                aria-label="Nombre del asistente"
                className="h-10 w-[160px] text-sm"
              />
            </SettingRow>

            <SettingRow
              title="Personalidad"
              description="Jarvis: trato de «señor», tono sereno, ingenio seco y reportes de estado. Copiloto: cercano y de tú."
            >
              <Segmented<AiPersona>
                ariaLabel="Personalidad de TECLA AI"
                value={preferences.aiPersona}
                onChange={(aiPersona) => setPreferences({ aiPersona })}
                options={[
                  { value: "jarvis", label: "Jarvis" },
                  { value: "copiloto", label: "Copiloto" },
                ]}
              />
            </SettingRow>

            <SettingRow
              title="Respuestas con voz"
              description={
                elevenLabsReady
                  ? "Las respuestas a órdenes habladas se reproducen con ElevenLabs. También puedes escuchar cualquier mensaje con su botón de altavoz."
                  : "ElevenLabs no está configurado. Las respuestas aparecen en texto; la conversación por texto sigue funcionando."
              }
            >
              <Switch
                checked={preferences.voiceEnabled}
                onCheckedChange={(checked) => setPreferences({ voiceEnabled: checked })}
                aria-label="Respuestas con voz"
                disabled={!elevenLabsReady}
              />
            </SettingRow>

            <SettingRow
              title="Escuchar al abrir"
              description="Al tocar TECLA AI, el micrófono se activa de inmediato y la orden se envía sola al terminar de hablar. Pensado para pedir música sin escribir."
            >
              <Switch
                checked={preferences.aiAutoListen}
                onCheckedChange={(checked) => setPreferences({ aiAutoListen: checked })}
                aria-label="Escuchar al abrir TECLA AI"
                disabled={!deepgramReady}
              />
            </SettingRow>

            <SettingRow
              title="«Oye TECLA» (palabra de activación)"
              description="Mantiene el reconocimiento de voz del navegador escuchando solo esa frase y abre TECLA AI por voz. Muestra un indicador visible y se apaga al salir de la app. El audio no pasa por los servidores de TECLA LIVE."
            >
              <Switch
                checked={preferences.wakeWordEnabled}
                onCheckedChange={(checked) => {
                  setPreferences({ wakeWordEnabled: checked, ...(checked ? { micConsent: true } : {}) });
                  if (checked) {
                    toast({
                      title: "«Oye TECLA» activado",
                      description: "Di «Oye TECLA» para hablar sin tocar la pantalla. Verás el indicador arriba.",
                      variant: "info",
                    });
                  }
                }}
                aria-label="Palabra de activación Oye TECLA"
                disabled={!deepgramReady}
              />
            </SettingRow>

            <SettingRow
              title="Saludo al iniciar"
              description="Al abrir TECLA AI por voz la primera vez en la sesión, Jarvis saluda con la hora, el clima real y lo que dejaste a medias. Solo cuesta una síntesis de voz."
            >
              <Switch
                checked={preferences.speakGreeting}
                onCheckedChange={(checked) => setPreferences({ speakGreeting: checked })}
                aria-label="Saludo al iniciar"
                disabled={!elevenLabsReady}
              />
            </SettingRow>

            <SettingRow
              title="Modo conversación"
              description="Después de responder, TECLA AI vuelve a escuchar automáticamente. Solo con micrófono compatible y permiso explícito."
            >
              <Switch
                checked={preferences.conversationMode}
                onCheckedChange={(checked) => {
                  setPreferences({ conversationMode: checked });
                  if (checked) {
                    toast({
                      title: "Modo conversación activado",
                      description: "TECLA AI volverá a escuchar al terminar de hablar. Puedes detenerlo con el botón cuadrado.",
                      variant: "info",
                    });
                  }
                }}
                aria-label="Modo conversación"
                disabled={!deepgramReady}
              />
            </SettingRow>

            <SettingRow
              title="Voz autorizada"
              description={
                elevenLabsReady
                  ? "Elige la voz de TECLA AI. Las voces las define el servidor (ELEVENLABS_VOICES); no necesitas cuenta de ElevenLabs."
                  : "Configura ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en el servidor."
              }
            >
              {elevenLabsReady ? (
                <select
                  aria-label="Voz autorizada de TECLA AI"
                  value={preferences.aiVoiceId}
                  onChange={(event) => {
                    setPreferences({ aiVoiceId: event.target.value });
                    toast({ title: "Voz actualizada", variant: "success" });
                  }}
                  className="min-h-10 max-w-[220px] rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  disabled={publicVoices.isLoading || publicVoices.isError}
                >
                  <option value="">
                    {publicVoices.data?.defaultVoiceName
                      ? `${publicVoices.data.defaultVoiceName.split(" - ")[0]} · Colombia (predeterminada)`
                      : "Voz predeterminada del servidor"}
                  </option>
                  {(["latino", "hombres", "mujeres"] as const).map((group) => {
                    const items = (publicVoices.data?.curated ?? []).filter((voice) => voice.group === group);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={group} label={publicVoices.data?.groups?.[group] ?? group}>
                        {items.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {me.data?.user && (voices.data?.voices ?? []).filter((voice) => !(publicVoices.data?.curated ?? []).some((item) => item.id === voice.id) && voice.id !== publicVoices.data?.defaultVoiceId).length > 0 ? (
                    <optgroup label="Otras voces de la cuenta del servidor">
                      {(voices.data?.voices ?? [])
                        .filter((voice) => !(publicVoices.data?.curated ?? []).some((item) => item.id === voice.id) && voice.id !== publicVoices.data?.defaultVoiceId)
                        .map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                </select>
              ) : (
                <Badge variant="warning">Pendiente</Badge>
              )}
            </SettingRow>

            <SettingRow
              title="Volumen de voz y reproductores compatibles"
              description="Se aplica a la voz de TECLA AI. El reproductor de YouTube conserva sus propios controles."
            >
              <div className="flex items-center gap-3">
                <Volume2 className="size-4 shrink-0 text-muted" aria-hidden />
                <Slider
                  aria-label="Volumen"
                  value={[preferences.volume]}
                  onValueChange={(value) =>
                    setPreferences({ volume: value[0] ?? preferences.volume })
                  }
                  min={0}
                  max={100}
                  step={5}
                  className="w-[150px]"
                />
                <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted">
                  {preferences.volume}%
                </span>
              </div>
            </SettingRow>

            <SettingRow
              title="Consentimiento de micrófono"
              description="TECLA LIVE no graba en segundo plano. El permiso del navegador se solicita al usar el micrófono."
            >
              <div className="flex items-center gap-3">
                <Badge variant={preferences.micConsent ? "success" : "outline"}>
                  {preferences.micConsent ? "Concedido" : "No concedido"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!preferences.micConsent}
                  onClick={() => {
                    setPreferences({ micConsent: false, conversationMode: false });
                    toast({
                      title: "Consentimiento retirado",
                      description: "Puedes volver a activarlo cuando uses el micrófono. El permiso del navegador se gestiona aparte.",
                      variant: "info",
                    });
                  }}
                >
                  Retirar
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              title="Memoria de preferencias"
              description="Permite que TECLA AI recuerde gustos que tú confirmes. Se guarda en este navegador y puedes borrarla."
            >
              <Switch
                checked={preferences.memoryConsent}
                onCheckedChange={(checked) => {
                  setPreferences({ memoryConsent: checked });
                  toast({
                    title: checked ? "Memoria activada" : "Memoria desactivada",
                    description: checked
                      ? "Solo se guardarán preferencias explícitas, no transcripciones."
                      : "No se guardarán nuevas preferencias.",
                    variant: "info",
                  });
                }}
                aria-label="Memoria de preferencias"
              />
            </SettingRow>

            <div className="px-5 py-4 md:px-6">
              <p className="text-[11px] leading-relaxed text-muted">
                Preferencias recordadas ({memoryEntries.length})
              </p>
              {memoryEntries.length === 0 ? (
                <p className="mt-1 text-[10px] leading-relaxed text-muted/70">
                  Aún no hay preferencias. Pídele a TECLA AI que recuerde algo, por ejemplo «recuerda
                  que me gusta el vallenato», y confirma.
                </p>
              ) : (
                <>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {memoryEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[10px]"
                      >
                        <span className="font-medium capitalize text-muted">{entry.key}:</span>
                        <span>{entry.value}</span>
                        <button
                          type="button"
                          onClick={() => removeMemory(entry.id)}
                          aria-label={`Borrar preferencia ${entry.value}`}
                          className="ml-0.5 text-muted hover:text-red-400"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-red-400"
                    onClick={() => {
                      clearMemory();
                      toast({ title: "Memoria borrada", variant: "success" });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Borrar memoria de preferencias
                  </Button>
                </>
              )}
            </div>

            <SettingRow
              title="Conversación actual"
              description="Los mensajes viven en la pestaña y no se guardan en el servidor."
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  useAi.getState().clearConversation();
                  toast({ title: "Conversación borrada", variant: "success" });
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Borrar conversación
              </Button>
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            id="clima"
            icon={MapPin}
            title="Clima y ubicación"
            description="Sincelejo es la ubicación inicial. Puedes cambiarla sin compartir tu geolocalización."
          >
            <div className="space-y-3 px-5 py-4 md:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{weatherLocation}</Badge>
                <span className="font-mono text-[10px] text-muted">
                  {preferences.weatherLat.toFixed(4)}, {preferences.weatherLon.toFixed(4)} · America/Bogota
                </span>
              </div>
              <form onSubmit={(event) => void locate(event)} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder="Ciudad o lugar, por ejemplo Medellín, Colombia"
                  aria-label="Buscar ubicación para el clima"
                  maxLength={80}
                  className="flex-1"
                />
                <Button type="submit" variant="glass" size="sm" loading={locating}>
                  <MapPin className="size-3.5" aria-hidden />
                  Buscar
                </Button>
              </form>
              {foundPlace ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/20 bg-accent/5 p-3">
                  <div>
                    <p className="text-xs font-medium">{foundPlace.label}</p>
                    <p className="font-mono text-[10px] text-muted">
                      {foundPlace.lat.toFixed(4)}, {foundPlace.lon.toFixed(4)}
                    </p>
                  </div>
                  <Button size="sm" onClick={savePlace}>
                    <Check className="size-3.5" aria-hidden />
                    Usar esta ubicación
                  </Button>
                </div>
              ) : null}
              <p className="text-[10px] leading-relaxed text-muted">
                La búsqueda usa Open-Meteo Geocoding. No pedimos tu ubicación GPS. El clima se consulta
                con las coordenadas guardadas.
              </p>
            </div>
          </SettingsSection>

          <SettingsSection
            id="cuenta"
            icon={KeyRound}
            title="Cuenta y sincronización"
            description="Opcional. El modo invitado nunca requiere cuenta."
          >
            <AccountSection />
          </SettingsSection>

          <SettingsSection
            id="orden"
            icon={ListOrdered}
            title="Orden del dashboard"
            description="Personaliza el orden de las secciones sin panel administrativo."
          >
            <div className="px-5 py-4 md:px-6">
              <ul className="space-y-1">
                {preferences.dashboardOrder.map((sectionId: DashboardSectionId, index) => (
                  <li
                    key={sectionId}
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-2 transition-colors hover:border-border hover:bg-surface/50"
                  >
                    <span className="w-5 text-center font-mono text-[10px] text-muted">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-medium">
                      {SECTION_LABELS.get(sectionId) ?? sectionId}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        onClick={() => moveSection(sectionId, "up")}
                        disabled={index === 0}
                        aria-label={`Subir ${SECTION_LABELS.get(sectionId) ?? sectionId}`}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        onClick={() => moveSection(sectionId, "down")}
                        disabled={index === preferences.dashboardOrder.length - 1}
                        aria-label={`Bajar ${SECTION_LABELS.get(sectionId) ?? sectionId}`}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() =>
                  setPreferences({
                    dashboardOrder: DASHBOARD_SECTIONS.map((section) => section.id),
                  })
                }
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Restablecer orden
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="privacidad"
            icon={ShieldCheck}
            title="Privacidad y datos"
            description="Transparencia sobre lo que se guarda y lo que no."
          >
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 md:px-6">
              <div className="rounded-2xl border border-border bg-surface/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Mic className="size-3.5 text-emerald-500" aria-hidden />
                  Audio y transcripciones
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  El audio se envía a Deepgram solo al usar el micrófono. TECLA LIVE no lo guarda.
                  La transcripción aparece en la conversación y no se persiste en el servidor.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-surface/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Cloud className="size-3.5 text-accent" aria-hidden />
                  Biblioteca local
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  Favoritos, historial, listas y preferencias viven en localStorage hasta que decidas
                  sincronizarlos con una cuenta.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 px-5 py-4 md:px-6">
              <Button variant="glass" size="sm" onClick={exportData}>
                <Download className="size-3.5" aria-hidden />
                Exportar mis datos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  useLibrary.getState().clearHistory();
                  toast({ title: "Historial borrado", variant: "success" });
                }}
              >
                Borrar historial
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  useLibrary.getState().clearSearches();
                  toast({ title: "Búsquedas borradas", variant: "success" });
                }}
              >
                Borrar búsquedas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  useLibrary.getState().clearFavorites();
                  toast({ title: "Favoritos borrados", variant: "success" });
                }}
              >
                Borrar favoritos
              </Button>
            </div>

            <div className="px-5 py-4 md:px-6">
              {!confirmWipe ? (
                <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setConfirmWipe(true)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Borrar todos mis datos locales
                </Button>
              ) : (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
                  <p className="text-xs font-medium text-red-400">¿Borrar todo?</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Se eliminarán favoritos, historial, listas, destinos, búsquedas, preferencias y la
                    conversación actual de este navegador. No afecta a tu cuenta ni a datos ya
                    sincronizados.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="danger" size="sm" onClick={wipeLocalData}>
                      Sí, borrar todo
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SettingsSection
            icon={Wifi}
            title="Integraciones"
            description="Estado real del servidor. Las claves nunca llegan al navegador."
          >
            <div className="space-y-3 px-5 py-4 md:px-5">
              {[
                {
                  label: "YouTube Data API",
                  env: "YOUTUBE_API_KEY",
                  active: status?.integrations.youtube,
                  note: "Búsqueda, tendencias y metadatos.",
                },
                {
                  label: "DeepSeek",
                  env: "DEEPSEEK_API_KEY",
                  active: status?.integrations.deepseek,
                  note: "Razonamiento y herramientas.",
                },
                {
                  label: "Deepgram",
                  env: "DEEPGRAM_API_KEY",
                  active: status?.integrations.deepgram,
                  note: "Transcripción de voz.",
                },
                {
                  label: "ElevenLabs",
                  env: "ELEVENLABS_API_KEY + VOICE_ID",
                  active: status?.integrations.elevenlabs,
                  note: "Voz sintetizada.",
                },
                {
                  label: "Spotify",
                  env: "SPOTIFY_CLIENT_ID + SECRET",
                  active: status?.integrations.spotify,
                  note: "OAuth y controles remotos.",
                },
                {
                  label: "PostgreSQL",
                  env: "DATABASE_URL",
                  active: status?.integrations.database,
                  note: "Cuentas y sincronización.",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <span className="mt-1.5">
                    <StatusDot active={Boolean(item.active)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{item.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{item.note}</p>
                    {!item.active ? (
                      <code className="mt-1 block truncate font-mono text-[9px] text-muted/70">
                        {item.env}
                      </code>
                    ) : null}
                  </div>
                  <Badge variant={item.active ? "success" : "outline"} className="shrink-0">
                    {item.active ? "Activo" : "Pendiente"}
                  </Badge>
                </div>
              ))}

              {status ? (
                <div className="space-y-1 border-t border-border pt-3 text-[10px] text-muted">
                  <p>Modelo DeepSeek: <span className="font-mono">{status.models.deepseek ?? "—"}</span></p>
                  <p>Modelo Deepgram: <span className="font-mono">{status.models.deepgram ?? "—"}</span></p>
                  <p>Modelo de voz: <span className="font-mono">{status.models.elevenlabs ?? "—"}</span></p>
                  <p>
                    Límites IA: {status.limits.maxToolSteps} pasos · {status.limits.maxTtsChars} caracteres ·
                    presupuesto ${status.limits.monthlyBudgetUsd}/mes
                  </p>
                </div>
              ) : integrations.isLoading ? (
                <p className="flex items-center gap-1.5 text-[10px] text-muted">
                  <RefreshCw className="size-3 animate-spin" aria-hidden />
                  Consultando estado…
                </p>
              ) : (
                <p className="text-[10px] text-muted">
                  No pudimos consultar el estado del servidor. La interfaz sigue disponible.
                </p>
              )}

              <Link
                href="/music"
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-[11px] font-medium text-muted transition-colors hover:text-foreground"
              >
                Vincular Spotify en Música
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </div>
          </SettingsSection>

          <SettingsSection icon={Accessibility} title="Atajos">
            <div className="space-y-2.5 px-5 py-4">
              {[
                { keys: "⌘ / Ctrl + K", label: "Búsqueda universal" },
                { keys: "⌘ / Ctrl + J", label: "Abrir TECLA AI" },
                { keys: "?", label: "Mostrar atajos" },
                { keys: "Esc", label: "Cerrar panel" },
                { keys: "Enter", label: "Enviar mensaje" },
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted">{shortcut.label}</span>
                  <kbd className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[9px] text-foreground">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </SettingsSection>

          <div className="rounded-[1.75rem] border border-border bg-gradient-to-br from-accent/[0.08] via-surface/40 to-violet/[0.08] p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Database className="size-4" aria-hidden />
              </span>
              <p className="text-xs font-semibold">TECLA LIVE 0.1</p>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Centro de entretenimiento para Tesla. Clima inicial en Sincelejo, Sucre. Zona horaria
              America/Bogota. Diseño propio inspirado en experiencias cinematográficas y controles
              táctiles amplios.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
              TECLA AI y el agente que programó esta aplicación son distintos. La IA de producto no
              tiene acceso al repositorio ni al servidor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
