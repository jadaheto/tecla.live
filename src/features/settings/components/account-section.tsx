"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Cloud, Download, LogOut, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch, errorMessage } from "@/lib/http";
import { useLibrary } from "@/stores/library";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/toast";
import type { HistoryEntry, MediaKind, SavedFavorite } from "@/types";

interface MeResponse {
  user: { id: string; email: string; name: string | null } | null;
  accountsAvailable: boolean;
}

interface SyncResponse {
  favorites: Array<{
    kind: string;
    providerId: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    href?: string;
    addedAt: string;
  }>;
  history: Array<{
    kind: string;
    providerId: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    href?: string;
    positionSeconds: number;
    durationSeconds: number;
    lastWatchedAt: string;
  }>;
  syncedAt: string;
}

export function AccountSection() {
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loadingPreferences, setLoadingPreferences] = React.useState(false);
  const setPreferences = usePreferences((state) => state.setPreferences);

  const me = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    staleTime: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const preferences = usePreferences.getState();
      const library = useLibrary.getState();
      return apiFetch<SyncResponse>("/api/library/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorites: library.favorites.slice(0, 300).map((favorite) => ({
            kind: favorite.kind,
            providerId: favorite.providerId,
            title: favorite.title,
            subtitle: favorite.subtitle,
            imageUrl: favorite.imageUrl,
            href: favorite.href,
          })),
          history: library.history.slice(0, 100).map((entry) => ({
            kind: entry.kind,
            providerId: entry.providerId,
            title: entry.title,
            subtitle: entry.subtitle,
            imageUrl: entry.imageUrl,
            href: entry.href,
            positionSeconds: entry.positionSeconds,
            durationSeconds: entry.durationSeconds,
            lastWatchedAt: entry.lastWatchedAt,
          })),
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
            aiVoiceId: preferences.aiVoiceId || undefined,
            weatherLocation: preferences.weatherLocation,
            weatherLat: preferences.weatherLat,
            weatherLon: preferences.weatherLon,
          },
        }),
      });
    },
    onSuccess: (data) => {
      const favorites: SavedFavorite[] = data.favorites.map((favorite) => ({
        kind: favorite.kind as MediaKind,
        providerId: favorite.providerId,
        title: favorite.title,
        subtitle: favorite.subtitle,
        imageUrl: favorite.imageUrl,
        href: favorite.href,
        addedAt: favorite.addedAt,
      }));
      const history: HistoryEntry[] = data.history.map((entry) => ({
        kind: entry.kind as MediaKind,
        providerId: entry.providerId,
        title: entry.title,
        subtitle: entry.subtitle,
        imageUrl: entry.imageUrl,
        href: entry.href,
        positionSeconds: entry.positionSeconds,
        durationSeconds: entry.durationSeconds,
        lastWatchedAt: entry.lastWatchedAt,
      }));
      useLibrary.getState().importLibrary({ favorites, history });
      toast({
        title: "Biblioteca sincronizada",
        description: `${data.favorites.length} favoritos y ${data.history.length} elementos de historial en tu cuenta.`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({ title: "No se pudo sincronizar", description: errorMessage(error), variant: "error" });
    },
  });

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mode === "register" && name.trim() ? { name: name.trim() } : {}),
        }),
      });
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast({
        title: mode === "login" ? "Sesión iniciada" : "Cuenta creada",
        description: "Sincroniza tu biblioteca local cuando quieras.",
        variant: "success",
      });
      setMode("login");
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPreferencesFromCloud() {
    setLoadingPreferences(true);
    try {
      const data = await apiFetch<{
        preferences: null | {
          theme: "light" | "dark" | "auto";
          displayMode: "normal" | "cinema" | "kiosk";
          autoThemeEnabled: boolean;
          autoThemeStart: string;
          autoThemeEnd: string;
          reduceMotion: boolean;
          voiceEnabled: boolean;
          conversationMode: boolean;
          volume: number;
          aiVoiceId: string | null;
          weatherLocation: string;
          weatherLat: number;
          weatherLon: number;
        };
      }>("/api/preferences");
      if (!data.preferences) {
        toast({ title: "Sin preferencias en la nube", description: "Sincroniza primero desde este dispositivo.", variant: "info" });
        return;
      }
      setPreferences({
        theme: data.preferences.theme,
        displayMode: data.preferences.displayMode,
        autoThemeEnabled: data.preferences.autoThemeEnabled,
        autoThemeStart: data.preferences.autoThemeStart,
        autoThemeEnd: data.preferences.autoThemeEnd,
        reduceMotion: data.preferences.reduceMotion,
        voiceEnabled: data.preferences.voiceEnabled,
        conversationMode: data.preferences.conversationMode,
        volume: data.preferences.volume,
        aiVoiceId: data.preferences.aiVoiceId ?? "",
        weatherLocation: data.preferences.weatherLocation,
        weatherLat: data.preferences.weatherLat,
        weatherLon: data.preferences.weatherLon,
      });
      toast({ title: "Preferencias cargadas", description: "Se aplicaron las preferencias de tu cuenta.", variant: "success" });
    } catch (error) {
      toast({ title: "No pudimos cargar las preferencias", description: errorMessage(error), variant: "error" });
    } finally {
      setLoadingPreferences(false);
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      toast({ title: "Sesión cerrada", description: "Tus datos locales siguen en este dispositivo.", variant: "info" });
    } catch (error) {
      toast({ title: "No se pudo cerrar sesión", description: errorMessage(error), variant: "error" });
    }
  }

  if (me.isLoading) {
    return (
      <div className="flex items-center gap-3 px-5 py-5 text-xs text-muted md:px-6">
        <RefreshCw className="size-4 animate-spin" aria-hidden />
        Comprobando cuenta…
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="px-5 py-5 text-xs leading-relaxed text-muted md:px-6">
        No pudimos comprobar la cuenta. Puedes seguir usando el modo invitado.
      </div>
    );
  }

  const user = me.data?.user;
  const accountsAvailable = me.data?.accountsAvailable ?? false;

  if (user) {
    return (
      <div className="space-y-4 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-violet/25 text-foreground">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name || user.email}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <Badge variant="success">Cuenta activa</Badge>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Sincroniza favoritos, historial y preferencias con PostgreSQL. Tú decides cuándo
          enviarlos; los datos locales no se borran.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => syncMutation.mutate()}
            loading={syncMutation.isPending}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Sincronizar ahora
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => void loadPreferencesFromCloud()}
            loading={loadingPreferences}
          >
            <Download className="size-3.5" aria-hidden />
            Cargar preferencias
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="size-3.5" aria-hidden />
            Cerrar sesión
          </Button>
        </div>

        {syncMutation.isSuccess ? (
          <p className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <CircleCheck className="size-3.5" aria-hidden />
            Última sincronización:{" "}
            {new Intl.DateTimeFormat("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Bogota",
            }).format(new Date(syncMutation.data.syncedAt))}
          </p>
        ) : null}
      </div>
    );
  }

  if (!accountsAvailable) {
    return (
      <div className="space-y-3 px-5 py-5 md:px-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Cloud className="size-4 text-muted" aria-hidden />
          Modo invitado
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Tu biblioteca y preferencias se guardan solo en este navegador. Para activar cuentas y
          sincronización, configura PostgreSQL (<code className="font-mono">DATABASE_URL</code>),{" "}
          <code className="font-mono">AUTH_SECRET</code> y ejecuta las migraciones.
        </p>
        <Badge variant="outline">Cuentas no configuradas</Badge>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submitForm(event)} className="space-y-4 px-5 py-5 md:px-6">
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
        {(["login", "register"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setFormError(null);
            }}
            className={
              mode === option
                ? "min-h-9 flex-1 rounded-full bg-surface-strong text-xs font-medium shadow-sm"
                : "min-h-9 flex-1 rounded-full text-xs font-medium text-muted hover:text-foreground"
            }
          >
            {option === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>

      {mode === "register" ? (
        <div>
          <label htmlFor="account-name" className="mb-1.5 block text-[11px] font-medium text-muted">
            Nombre (opcional)
          </label>
          <Input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            placeholder="Cómo quieres que te llamemos"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="account-email" className="mb-1.5 block text-[11px] font-medium text-muted">
          Correo
        </label>
        <Input
          id="account-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />
      </div>

      <div>
        <label htmlFor="account-password" className="mb-1.5 block text-[11px] font-medium text-muted">
          Contraseña
        </label>
        <Input
          id="account-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 10 : 1}
          maxLength={128}
          placeholder={mode === "register" ? "Mínimo 10 caracteres, letras y números" : "Tu contraseña"}
        />
      </div>

      {formError ? (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-500">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="submit" size="sm" loading={submitting}>
          {mode === "login" ? "Entrar" : "Crear mi cuenta"}
        </Button>
        <p className="text-[10px] text-muted">
          {mode === "register"
            ? "No guardamos tu contraseña en texto plano."
            : "Sesión con cookie HttpOnly."}
        </p>
      </div>

      <p className="text-[10px] leading-relaxed text-muted/70">
        Al crear una cuenta aceptas que se guarden tus preferencias y biblioteca. El audio y las
        transcripciones no se almacenan por defecto.
      </p>
    </form>
  );
}
