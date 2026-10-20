"use client";

import * as React from "react";
import {
  ExternalLink,
  Gamepad2,
  Heart,
  Loader2,
  MessageSquare,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLibrary } from "@/stores/library";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

const CHANNEL_PATTERN = /^[a-zA-Z0-9_]{3,25}$/;

function normalizeChannel(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (CHANNEL_PATTERN.test(clean)) return clean.toLowerCase();
  try {
    const url = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
    if (!url.hostname.endsWith("twitch.tv")) return null;
    const segment = url.pathname.split("/").filter(Boolean)[0];
    return segment && CHANNEL_PATTERN.test(segment) ? segment.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function TwitchPage() {
  const [hostname, setHostname] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [channel, setChannel] = React.useState<string | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const favorites = useLibrary((state) => state.favorites);
  const toggleFavorite = useLibrary((state) => state.toggleFavorite);

  React.useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  const favoriteChannels = favorites.filter((favorite) => favorite.kind === "channel");

  function loadChannel(raw: string) {
    const normalized = normalizeChannel(raw);
    if (!normalized) {
      setError("Escribe un canal válido de Twitch (letras, números y guion bajo).");
      return;
    }
    setError(null);
    setChannel(normalized);
    setInput(normalized);
    try {
      window.history.replaceState(null, "", `/twitch?channel=${normalized}`);
    } catch {
      // Ignorar.
    }
  }

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("channel");
    if (initial) {
      const normalized = normalizeChannel(initial);
      if (normalized) {
        setChannel(normalized);
        setInput(normalized);
      }
    }
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    loadChannel(input);
  }

  function favoriteChannel() {
    if (!channel) return;
    const added = toggleFavorite({
      kind: "channel",
      providerId: channel,
      title: channel,
      subtitle: "Canal de Twitch",
      href: `/twitch?channel=${channel}`,
    });
    toast({
      title: added ? "Canal guardado" : "Canal quitado",
      description: channel,
      variant: added ? "success" : "info",
    });
  }

  const playerUrl =
    hostname && channel
      ? `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(
          hostname,
        )}&muted=false`
      : null;
  const chatUrl =
    hostname && channel
      ? `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${encodeURIComponent(
          hostname,
        )}&darkpopout`
      : null;
  const isFavorite = channel
    ? favoriteChannels.some((favorite) => favorite.providerId === channel)
    : false;

  return (
    <div>
      <PageHeader
        eyebrow="En vivo"
        title="Twitch sin distracciones."
        description="Abre el reproductor oficial por canal. Sin credenciales de Twitch configuradas no hacemos búsquedas de directorio; usamos el embed oficial y la búsqueda externa."
        actions={
          <a
            href={`https://www.twitch.tv/search?term=${encodeURIComponent(input || "en vivo")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Buscar en Twitch
            <ExternalLink className="size-3" aria-hidden />
          </a>
        }
      />

      <div className="rounded-3xl border border-border bg-surface/45 p-4 md:p-5">
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Gamepad2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="nombre_del_canal o enlace de Twitch"
              aria-label="Canal de Twitch"
              className="h-12 pl-11"
              maxLength={120}
            />
          </div>
          <Button type="submit" size="lg">
            <Tv className="size-4" aria-hidden />
            Abrir canal
          </Button>
        </form>
        {error ? <p className="mt-2 text-[11px] text-red-400">{error}</p> : null}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {channel && playerUrl ? (
            <div className="overflow-hidden rounded-[1.8rem] border border-border bg-black shadow-[var(--shadow-card)]">
              <iframe
                key={playerUrl}
                src={playerUrl}
                title={`Transmisión de Twitch: ${channel}`}
                allowFullScreen
                className="aspect-video w-full"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
              />
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#0b0b0e] p-4 text-white">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {channel}
                    <Badge variant="live">
                      <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
                      Embed
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/45">
                    El reproductor muestra el estado real del canal. Si está fuera de línea, Twitch
                    lo indicará.
                  </p>
                </div>
                <Button variant="glass" size="sm" onClick={favoriteChannel}>
                  <Heart className={cn("size-3.5", isFavorite && "fill-red-400 text-red-400")} aria-hidden />
                  {isFavorite ? "Guardado" : "Guardar"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatOpen((open) => !open)}
                  aria-label="Mostrar u ocultar chat"
                  aria-pressed={chatOpen}
                  className="text-white/70 hover:bg-white/10"
                >
                  <MessageSquare className="size-4" />
                </Button>
                <a
                  href={`https://www.twitch.tv/${channel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-9 items-center gap-1 rounded-full border border-white/15 px-3 text-[10px] text-white/70"
                >
                  Abrir en Twitch
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>

              {chatOpen && chatUrl ? (
                <iframe
                  src={chatUrl}
                  title={`Chat de Twitch: ${channel}`}
                  className="h-[320px] w-full border-t border-white/10 bg-[#0b0b0e]"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : null}
            </div>
          ) : (
            <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[1.8rem] border border-border bg-[#0a090d] p-8 text-center text-white">
              <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_20%_0%,rgba(169,112,255,0.24),transparent_60%),radial-gradient(70%_70%_at_95%_80%,rgba(255,90,60,0.14),transparent_60%)]" />
              <div className="relative">
                <span className="mx-auto flex size-20 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-[#a970ff]">
                  <Gamepad2 className="size-9" aria-hidden />
                </span>
                <h2 className="mt-5 text-display text-3xl">¿A quién vemos?</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                  Escribe el nombre del canal. Usamos el reproductor oficial de Twitch con el
                  parent correcto para este dominio.
                </p>
                {favoriteChannels.length > 0 ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {favoriteChannels.slice(0, 6).map((favorite) => (
                      <button
                        key={favorite.providerId}
                        type="button"
                        onClick={() => loadChannel(favorite.providerId)}
                        className="min-h-9 rounded-full border border-white/15 px-3 text-[11px] text-white/70 transition-colors hover:bg-white/10"
                      >
                        {favorite.providerId}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {channel && hostname ? (
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Si el embed no carga, Twitch puede estar bloqueando el parent o el canal puede requerir
              apertura externa. No intentamos eludir esa restricción.
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-3">Canales guardados</p>
            {favoriteChannels.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted">
                Guarda un canal para abrirlo rápido. Los favoritos de Twitch viven en tu biblioteca
                local.
              </p>
            ) : (
              <div className="space-y-1.5">
                {favoriteChannels.map((favorite) => (
                  <button
                    key={favorite.providerId}
                    type="button"
                    onClick={() => loadChannel(favorite.providerId)}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-transparent px-2 text-left transition-colors hover:border-border hover:bg-surface"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#a970ff]/10 text-[#a970ff]">
                      <Gamepad2 className="size-3.5" aria-hidden />
                    </span>
                    <span className="flex-1 truncate text-xs font-medium">{favorite.providerId}</span>
                    <ExternalLink className="size-3 text-muted" aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-surface/45 p-5">
            <p className="eyebrow mb-2">Cómo funciona</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Twitch no ofrece reproducción directa sin su reproductor oficial. Este iframe usa el
              parent de TECLA LIVE. La búsqueda de canales se delega a Twitch porque no hay
              credenciales de su API configuradas.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
              No descargamos transmisiones ni eludimos restricciones. Respeta las normas de Twitch y
              los derechos de los creadores.
            </p>
          </div>

          {hostname ? (
            <div className="rounded-3xl border border-border bg-surface/45 p-5">
              <p className="eyebrow mb-2">Parent del embed</p>
              <code className="block truncate rounded-lg border border-border bg-surface px-2.5 py-2 font-mono text-[10px] text-muted">
                {hostname}
              </code>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-3xl border border-border bg-surface/45 p-5 text-[11px] text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Preparando embed…
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
