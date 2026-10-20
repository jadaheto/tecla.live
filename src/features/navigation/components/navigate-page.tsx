"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookmarkPlus,
  Briefcase,
  ExternalLink,
  Home,
  Map,
  MapPin,
  Navigation,
  Plus,
  Route,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibrary } from "@/stores/library";
import { toast } from "@/stores/toast";
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsSearchUrl,
  buildWazeSearchUrl,
  WAZE_LIVE_MAP_URL,
} from "@/lib/integrations/navigation";
import { cn } from "@/lib/utils";

type Provider = "waze" | "maps";
type DestinationKind = "home" | "work" | "custom";

export function NavigatePage() {
  const params = useSearchParams();
  const initialTab = params.get("tab") === "maps" ? "maps" : "waze";
  const initialQuery = params.get("q") ?? "";
  const [tab, setTab] = React.useState<Provider>(initialTab);
  const [query, setQuery] = React.useState(initialQuery);
  const [input, setInput] = React.useState(initialQuery);
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState<DestinationKind>("custom");
  const [showForm, setShowForm] = React.useState(false);

  const destinations = useLibrary((state) => state.destinations);
  const recent = useLibrary((state) => state.recentDestinations);
  const addDestination = useLibrary((state) => state.addDestination);
  const removeDestination = useLibrary((state) => state.removeDestination);
  const addRecentDestination = useLibrary((state) => state.addRecentDestination);
  const clearRecentDestinations = useLibrary((state) => state.clearRecentDestinations);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const clean = input.trim();
    if (clean.length < 2) return;
    setQuery(clean);
    addRecentDestination(clean, tab);
  }

  function saveDestination(event: React.FormEvent) {
    event.preventDefault();
    const address = query.trim() || input.trim();
    if (address.length < 2) {
      toast({ title: "Primero busca un destino", variant: "info" });
      return;
    }
    const finalLabel = label.trim() || (kind === "home" ? "Casa" : kind === "work" ? "Trabajo" : address);
    addDestination({ label: finalLabel, address, kind });
    setLabel("");
    setShowForm(false);
    toast({ title: "Destino guardado", description: finalLabel, variant: "success" });
  }

  function quickSave(targetKind: DestinationKind) {
    const address = query.trim();
    if (!address) {
      toast({ title: "Busca un destino primero", variant: "info" });
      return;
    }
    addDestination({
      label: targetKind === "home" ? "Casa" : targetKind === "work" ? "Trabajo" : address,
      address,
      kind: targetKind,
    });
    toast({
      title: targetKind === "home" ? "Casa guardada" : targetKind === "work" ? "Trabajo guardado" : "Destino guardado",
      description: address,
      variant: "success",
    });
  }

  const wazeUrl = query ? buildWazeSearchUrl(query) : null;
  const mapsUrl = query ? buildGoogleMapsRouteUrl(query) : null;
  const mapsSearchUrl = query ? buildGoogleMapsSearchUrl(query) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Movilidad"
        title="Navega sin rodeos."
        description="Prepara destinos y abre Waze o Google Maps de forma oficial. TECLA LIVE no conduce ni simula navegación embebida."
        actions={
          <Badge variant="outline">
            <Navigation className="size-3" aria-hidden />
            Sin GPS
          </Badge>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value === "maps" ? "maps" : "waze")}>
        <TabsList>
          <TabsTrigger value="waze">
            <Navigation className="mr-1.5 size-3.5" aria-hidden />
            Waze
          </TabsTrigger>
          <TabsTrigger value="maps">
            <Map className="mr-1.5 size-3.5" aria-hidden />
            Google Maps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waze">
          <NavigationPanel
            provider="waze"
            input={input}
            setInput={setInput}
            query={query}
            onSearch={search}
            primaryUrl={wazeUrl}
            secondaryUrl={mapsSearchUrl}
            onSaveClick={() => setShowForm(true)}
            onQuickSave={quickSave}
            recent={recent}
            onRecent={(value) => {
              setQuery(value);
              setInput(value);
              setTab("waze");
            }}
            onClearRecent={clearRecentDestinations}
          />
        </TabsContent>

        <TabsContent value="maps">
          <NavigationPanel
            provider="maps"
            input={input}
            setInput={setInput}
            query={query}
            onSearch={search}
            primaryUrl={mapsUrl}
            secondaryUrl={wazeUrl}
            onSaveClick={() => setShowForm(true)}
            onQuickSave={quickSave}
            recent={recent}
            onRecent={(value) => {
              setQuery(value);
              setInput(value);
              setTab("maps");
            }}
            onClearRecent={clearRecentDestinations}
          />
        </TabsContent>
      </Tabs>

      {showForm ? (
        <form
          onSubmit={saveDestination}
          className="mt-4 rounded-3xl border border-accent/25 bg-accent/[0.04] p-4 md:p-5"
        >
          <p className="text-sm font-medium">Guardar destino</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Se guarda en este navegador. No se envía tu ubicación.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nombre: casa, oficina, playa…"
              aria-label="Nombre del destino"
              maxLength={80}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Dirección o lugar"
              aria-label="Dirección del destino"
              maxLength={160}
            />
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as DestinationKind)}
              aria-label="Tipo de destino"
              className="min-h-12 rounded-2xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <option value="custom">Favorito</option>
              <option value="home">Casa</option>
              <option value="work">Trabajo</option>
            </select>
            <Button type="submit" size="lg">
              <BookmarkPlus className="size-4" aria-hidden />
              Guardar
            </Button>
          </div>
        </form>
      ) : null}

      <section className="mt-6" aria-label="Destinos guardados">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="eyebrow">Accesos</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">Destinos guardados</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" aria-hidden />
            Añadir
          </Button>
        </div>

        {destinations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-6 text-center">
            <MapPin className="mx-auto size-6 text-muted" aria-hidden />
            <p className="mt-2 text-sm font-medium">Sin destinos todavía</p>
            <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-muted">
              Busca un lugar arriba y guárdalo como Casa, Trabajo o favorito. Los enlaces abren las
              aplicaciones oficiales.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {destinations.map((destination) => (
              <div
                key={destination.id}
                className="rounded-3xl border border-border bg-surface/45 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-aqua/10 text-aqua">
                      {destination.kind === "home" ? (
                        <Home className="size-4" aria-hidden />
                      ) : destination.kind === "work" ? (
                        <Briefcase className="size-4" aria-hidden />
                      ) : (
                        <MapPin className="size-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{destination.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted">
                        {destination.address}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDestination(destination.id)}
                    aria-label={`Eliminar ${destination.label}`}
                    className="flex size-8 items-center justify-center rounded-full text-muted hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={buildWazeSearchUrl(destination.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-[#37d6ff]/10 text-[10px] font-medium text-[#37d6ff]"
                  >
                    Waze <ExternalLink className="size-2.5" aria-hidden />
                  </a>
                  <a
                    href={buildGoogleMapsSearchUrl(destination.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500/10 text-[10px] font-medium text-emerald-500"
                  >
                    Maps <ExternalLink className="size-2.5" aria-hidden />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Waze y Google Maps se abren en sus sitios o aplicaciones oficiales. TECLA LIVE no puede
          conocer el estado de conducción del vehículo. No manipules la pantalla mientras conduces.
        </p>
      </div>
    </div>
  );
}

function NavigationPanel({
  provider,
  input,
  setInput,
  query,
  onSearch,
  primaryUrl,
  secondaryUrl,
  onSaveClick,
  onQuickSave,
  recent,
  onRecent,
  onClearRecent,
}: {
  provider: Provider;
  input: string;
  setInput: (value: string) => void;
  query: string;
  onSearch: (event: React.FormEvent) => void;
  primaryUrl: string | null;
  secondaryUrl: string | null;
  onSaveClick: () => void;
  onQuickSave: (kind: DestinationKind) => void;
  recent: Array<{ query: string; provider: Provider }>;
  onRecent: (query: string) => void;
  onClearRecent: () => void;
}) {
  const isWaze = provider === "waze";
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <form
          onSubmit={onSearch}
          className="flex flex-col gap-2 rounded-3xl border border-border bg-surface/45 p-4 sm:flex-row md:p-5"
        >
          <div className="relative flex-1">
            <MapPin
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={isWaze ? "¿A dónde vamos? Dirección o lugar" : "Busca un lugar o dirección"}
              aria-label={isWaze ? "Destino para Waze" : "Destino para Google Maps"}
              className="h-12 pl-11"
              maxLength={160}
            />
          </div>
          <Button type="submit" size="lg">
            <Route className="size-4" aria-hidden />
            Preparar ruta
          </Button>
        </form>

        <div className="relative mt-4 min-h-[330px] overflow-hidden rounded-[2rem] border border-border bg-[#0a090d] p-6 text-white md:min-h-[380px] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_20%_0%,rgba(55,214,255,0.18),transparent_60%),radial-gradient(80%_70%_at_95%_60%,rgba(94,234,212,0.12),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute -right-24 -top-24 size-72 rounded-full border border-white/10" />
          <div className="absolute -right-8 -top-8 size-52 rounded-full border border-white/10" />
          <div className="relative flex h-full min-h-[270px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] backdrop-blur">
                {isWaze ? <Navigation className="size-3" aria-hidden /> : <Map className="size-3" aria-hidden />}
                {isWaze ? "Waze" : "Google Maps"}
              </span>
              <span className="text-[10px] text-white/40">Enlace oficial</span>
            </div>

            <div className="mt-10">
              <p className="eyebrow !text-white/50">
                {isWaze ? "Ruta preparada" : "Destino"}
              </p>
              <h2 className="mt-2 max-w-lg text-display text-3xl md:text-4xl">
                {query || (isWaze ? "¿A dónde vamos?" : "¿Qué lugar buscas?")}
              </h2>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-white/55">
                {query
                  ? isWaze
                    ? "Abre el enlace para iniciar la navegación en Waze. La ruta y los avisos de huecos, cámaras y policía los muestra Waze dentro de su app o mapa oficial."
                    : "Abre la ruta en Google Maps. La app o el sitio calculan el trayecto y el tráfico."
                  : "Escribe un destino para generar un enlace válido. No pedimos tu ubicación."}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <a
                href={primaryUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!primaryUrl}
                onClick={(event) => {
                  if (!primaryUrl) event.preventDefault();
                }}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-medium",
                  primaryUrl
                    ? isWaze
                      ? "bg-[#37d6ff] text-[#03141c]"
                      : "bg-[#5eead4] text-[#031a15]"
                    : "pointer-events-none bg-white/10 text-white/35",
                )}
              >
                {isWaze ? <Navigation className="size-4" aria-hidden /> : <Map className="size-4" aria-hidden />}
                {isWaze ? "Abrir ruta en Waze" : "Abrir ruta en Maps"}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <a
                href={secondaryUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!secondaryUrl}
                onClick={(event) => {
                  if (!secondaryUrl) event.preventDefault();
                }}
                className={cn(
                  "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-medium text-white/85 transition-colors hover:bg-white/10",
                  !secondaryUrl && "pointer-events-none opacity-40",
                )}
              >
                {isWaze ? "Abrir en Google Maps" : "Abrir en Waze"}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <button
                type="button"
                onClick={onSaveClick}
                disabled={!query}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-medium text-white/65 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <BookmarkPlus className="size-4" aria-hidden />
                Guardar
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
          <span>Guardar rápido:</span>
          <button
            type="button"
            onClick={() => onQuickSave("home")}
            className="flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 transition-colors hover:text-foreground"
          >
            <Home className="size-3" aria-hidden /> Casa
          </button>
          <button
            type="button"
            onClick={() => onQuickSave("work")}
            className="flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 transition-colors hover:text-foreground"
          >
            <Briefcase className="size-3" aria-hidden /> Trabajo
          </button>
          <button
            type="button"
            onClick={() => onQuickSave("custom")}
            className="flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 transition-colors hover:text-foreground"
          >
            <MapPin className="size-3" aria-hidden /> Favorito
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        {isWaze ? (
          <div className="rounded-3xl border border-[#33ccff]/20 bg-gradient-to-br from-[#33ccff]/10 via-surface/45 to-surface/35 p-5">
            <p className="eyebrow flex items-center gap-1.5 !text-[#33ccff]">
              <TriangleAlert className="size-3.5" aria-hidden />
              Avisos de Waze
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Huecos, cámaras y policía son reportes de la comunidad de Waze. TECLA LIVE
              <strong className="font-medium text-foreground"> no los recibe ni los dibuja</strong>:
              Waze no ofrece una API pública de consumidor para leer esas alertas. Se muestran solo
              dentro de su app o de su mapa oficial.
            </p>
            <a
              href={WAZE_LIVE_MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#33ccff]/25 bg-[#33ccff]/10 px-3 text-[11px] font-medium text-[#33ccff] transition-colors hover:bg-[#33ccff]/15"
            >
              Abrir mapa en vivo de Waze
              <ExternalLink className="size-3" aria-hidden />
            </a>
            <p className="mt-2 text-[9px] leading-relaxed text-muted/60">
              Los avisos no se simulan. Para integrarlos dentro de TECLA LIVE haría falta acceso
              autorizado a un feed de tráfico de Waze (partner) o a un proveedor licenciado.
            </p>
          </div>
        ) : null}

        <div className="rounded-3xl border border-border bg-surface/45 p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Recientes</p>
            {recent.length > 0 ? (
              <button type="button" onClick={onClearRecent} className="text-[10px] text-muted hover:text-foreground">
                Limpiar
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Los destinos que busques aparecerán aquí en este dispositivo.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recent.map((item) => (
                <button
                  key={`${item.provider}-${item.query}`}
                  type="button"
                  onClick={() => onRecent(item.query)}
                  className="max-w-full truncate rounded-full border border-border px-3 py-1.5 text-[10px] text-muted transition-colors hover:text-foreground"
                >
                  {item.provider === "waze" ? "Waze · " : "Maps · "}
                  {item.query}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-surface/45 p-5">
          <p className="eyebrow mb-2">Privacidad</p>
          <p className="text-[11px] leading-relaxed text-muted">
            No solicitamos geolocalización. Los enlaces contienen solo el destino que escribes y se
            abren en Waze o Google Maps. TECLA LIVE no recibe tu posición.
          </p>
          <Link
            href="/favorites"
            className="mt-3 flex min-h-9 items-center gap-1.5 text-[11px] font-medium text-foreground"
          >
            Ver todos mis destinos
          </Link>
        </div>
      </aside>
    </div>
  );
}
