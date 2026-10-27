"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BatteryCharging,
  Car,
  Compass,
  DoorOpen,
  Fan,
  Gauge,
  History,
  Lock,
  LockOpen,
  MapPin,
  MoonStar,
  Plug,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { HoloCar } from "@/components/holo/holo-car";
import { ChargersExplorer } from "@/components/charging/chargers-explorer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chargingLabel,
  useTeslaChargers,
  useTeslaChargingHistory,
  useTeslaDetail,
  useTeslaStatus,
  type TeslaDetail,
} from "@/features/tesla/hooks";
import { compassLabel } from "@/features/drive/telemetry";
import { apiFetch, errorMessage } from "@/lib/http";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/stores/preferences";

function dash(value: number | string | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix}`;
}

function yesNo(value: boolean | null | undefined, yes = "Sí", no = "No"): string {
  if (value === null || value === undefined) return "—";
  return value ? yes : no;
}

function minutesOfDay(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function seatLabel(level: number | null): string {
  if (level === null) return "—";
  return level === 0 ? "Apagado" : `Nivel ${level}`;
}

function Reading({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-1 text-[17px] font-semibold tabular-nums leading-tight", tone === "warn" && "text-amber-400", tone === "bad" && "text-red-400", tone === "ok" && "text-emerald-400")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Section({ icon: Icon, title, description, children, className }: { icon: typeof Car; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

/**
 * Pantalla «Mi Tesla»: todo lo que la Fleet API permite leer con los
 * permisos de datos, ubicación y carga. Solo lectura: nada se envía al auto
 * salvo «Despertar», que el usuario pide de forma explícita.
 */
export function TeslaPage() {
  const status = useTeslaStatus();
  const connected = status.data?.connected ?? false;
  const detailQuery = useTeslaDetail(connected);
  const summary = detailQuery.data?.summary ?? null;
  const detail = detailQuery.data?.detail ?? null;
  const awake = Boolean(summary && !summary.asleep);
  const chargers = useTeslaChargers(connected && awake);
  const history = useTeslaChargingHistory(connected);
  const weatherLat = usePreferences((state) => state.weatherLat);
  const weatherLon = usePreferences((state) => state.weatherLon);
  const weatherLocation = usePreferences((state) => state.weatherLocation);
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => apiFetch("/api/tesla/detail?refresh=1"),
    onSuccess: (data) => {
      queryClient.setQueryData(["tesla-detail"], data);
      void queryClient.invalidateQueries({ queryKey: ["tesla-vehicle"] });
    },
  });
  const wake = useMutation({
    mutationFn: () => apiFetch<{ state: string | null }>("/api/tesla/wake", { method: "POST" }),
    onSuccess: () => {
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["tesla-detail"] });
        void queryClient.invalidateQueries({ queryKey: ["tesla-vehicle"] });
      }, 8_000);
    },
  });

  if (status.isLoading) {
    return (
      <div>
        <PageHeader eyebrow="Tesla Fleet API" title="Mi Tesla" />
        <Skeleton className="h-64 w-full rounded-[2rem]" />
      </div>
    );
  }

  if (!status.data?.configured || !connected) {
    return (
      <div>
        <PageHeader eyebrow="Tesla Fleet API" title="Mi Tesla" description="Batería, carga, clima, carrocería, llantas, ubicación, software, cargadores cercanos e historial de carga, leídos de tu auto." />
        <Card className="flex flex-col items-start gap-4 p-6">
          <HoloCar width={320} height={180} label="Holograma de un Tesla" />
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            {!status.data?.configured
              ? "La conexión con Tesla no está configurada en el servidor."
              : status.data.authenticated
                ? "Vincula tu cuenta de Tesla en Ajustes → Mi Tesla para ver aquí todo lo que la Fleet API permite leer."
                : "Inicia sesión en TECLA LIVE y vincula tu cuenta de Tesla para ver aquí el estado completo del auto."}
          </p>
          <Link href="/settings#mi-tesla" className="text-sm font-medium text-accent hover:underline">
            Ir a Ajustes → Mi Tesla
          </Link>
        </Card>
      </div>
    );
  }

  const charging = summary?.charging === "charging";
  const battery = summary?.batteryPercent ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Tesla Fleet API · solo lectura"
        title={summary?.name ?? "Mi Tesla"}
        description={
          summary
            ? `${detail?.identity.model ?? "Tesla"}${detail?.identity.trim ? ` ${detail.identity.trim}` : ""} · ${summary.asleep ? "durmiendo" : summary.state ?? "en línea"} · lectura ${summary.cached ? "en caché" : "nueva"} de ${formatDate(summary.observedAt)}`
            : "Consultando el vehículo…"
        }
        actions={
          <>
            {summary?.asleep ? (
              <Button variant="primary" size="sm" onClick={() => wake.mutate()} loading={wake.isPending} disabled={wake.isSuccess}>
                <MoonStar className="size-3.5" aria-hidden />
                {wake.isSuccess ? "Despertando…" : "Despertar"}
              </Button>
            ) : null}
            <Button variant="glass" size="sm" onClick={() => refresh.mutate()} loading={refresh.isPending || detailQuery.isFetching}>
              <RefreshCw className="size-3.5" aria-hidden />
              Actualizar
            </Button>
          </>
        }
      />

      {detailQuery.isError ? (
        <Card className="mb-4 border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-200/90">{errorMessage(detailQuery.error)}</Card>
      ) : null}
      {wake.isError ? <Card className="mb-4 border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{errorMessage(wake.error)}</Card> : null}

      {/* Resumen con holograma */}
      <Card className="relative mb-4 overflow-hidden p-5 md:p-6">
        <div className={cn("pointer-events-none absolute -right-10 -top-20 size-72 rounded-full blur-3xl", charging ? "bg-emerald-400/15" : "bg-accent/10")} />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:items-center">
          <div>
            <p className="eyebrow">Estado general</p>
            {summary?.asleep ? (
              <>
                <p className="mt-2 text-display text-3xl">Durmiendo</p>
                <p className="mt-2 max-w-md text-sm text-muted">El auto está en reposo y no reporta datos. Despertarlo consume un poco de batería; úsalo solo si quieres ver el estado ahora.</p>
              </>
            ) : (
              <>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-display text-[3.6rem] leading-none tabular-nums">{dash(summary?.batteryPercent, "%")}</span>
                  <div className="pb-1.5">
                    <p className="text-sm font-medium">{summary?.rangeKm !== null && summary?.rangeKm !== undefined ? `${summary.rangeKm} km de autonomía` : "Autonomía no disponible"}</p>
                    <p className="text-[11px] text-muted">{summary ? chargingLabel(summary) : ""}{charging && summary?.chargerPowerKw ? ` · ${summary.chargerPowerKw} kW` : ""}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <div className={cn("h-full rounded-full transition-[width] duration-700", charging ? "bg-emerald-400" : battery <= 20 ? "bg-red-400" : "bg-accent")} style={{ width: `${Math.max(2, Math.min(100, battery))}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={summary?.locked ? "success" : "warning"}>{summary?.locked ? "Bloqueado" : "Sin bloquear"}</Badge>
                  <Badge variant={summary?.pluggedIn ? "success" : "outline"}>{summary?.pluggedIn ? "Conectado al cargador" : "Sin cable"}</Badge>
                  <Badge variant={summary?.climateOn ? "success" : "outline"}>{summary?.climateOn ? "Clima activo" : "Clima apagado"}</Badge>
                  <Badge variant={summary?.sentryMode ? "live" : "outline"}>{summary?.sentryMode ? "Centinela activo" : "Centinela apagado"}</Badge>
                  {summary?.userPresent ? <Badge variant="default">Alguien a bordo</Badge> : null}
                </div>
              </>
            )}
          </div>
          <HoloCar width={380} height={210} intensity={charging ? 1.6 : 1} color={charging ? "#34d399" : battery <= 20 && !summary?.asleep ? "#f87171" : undefined} className="mx-auto max-w-full" label={`Holograma de ${summary?.name ?? "tu Tesla"}`} />
        </div>
      </Card>

      {detail ? <DetailSections detail={detail} /> : null}

      <Section
        icon={MapPin}
        title="Estaciones de carga cercanas"
        description={summary?.location ? "Estaciones alrededor de la posición real del auto; toca una para ver la ruta." : "Estaciones alrededor de tu ciudad; con el auto despierto se centra en su posición real."}
        className="mt-4"
      >
        <ChargersExplorer
          origin={summary?.location ?? { latitude: weatherLat, longitude: weatherLon }}
          originKind={summary?.location ? "car" : "device"}
          originLabel={summary?.location ? (summary.name ?? "el auto") : (weatherLocation.split(",")[0]?.trim() ?? "tu ciudad")}
          compact
        />
        <p className="mt-3 text-[11px] text-muted">
          La pestaña <Link href="/cargadores" className="text-accent hover:underline">Cargadores</Link> tiene la misma vista a pantalla completa.
        </p>
      </Section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section icon={Zap} title="Cargadores según Tesla" description="Lo que reporta la Fleet API alrededor del auto (en Colombia suele ser poco). Requiere el auto despierto.">
          {!awake ? (
            <p className="text-sm text-muted">Disponible cuando el auto está despierto.</p>
          ) : chargers.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : chargers.isError ? (
            <p className="text-sm text-amber-300/90">{errorMessage(chargers.error)}</p>
          ) : (chargers.data?.superchargers.length ?? 0) + (chargers.data?.destinations.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">Tesla no reporta cargadores en 60 km. Usa el mapa de PlugShare de arriba.</p>
          ) : (
            <ul className="divide-y divide-border">
              {[...(chargers.data?.superchargers ?? []), ...(chargers.data?.destinations ?? [])].slice(0, 8).map((site, index) => (
                <li key={`${site.name}-${index}`} className="flex items-center gap-3 py-2.5">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", site.type === "supercharger" ? "bg-red-500/15 text-red-400" : "bg-surface text-muted")}>
                    <Zap className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{site.name}</p>
                    <p className="text-[11px] text-muted">
                      {site.type === "supercharger" ? "Supercargador" : "Cargador de destino"}
                      {site.distanceKm !== null ? ` · ${site.distanceKm} km` : ""}
                      {site.closed ? " · cerrado" : ""}
                    </p>
                  </div>
                  {site.totalStalls !== null ? (
                    <Badge variant={(site.availableStalls ?? 0) > 0 ? "success" : "warning"}>
                      {site.availableStalls ?? "?"}/{site.totalStalls} libres
                    </Badge>
                  ) : null}
                  {site.location ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${site.location.latitude},${site.location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-accent hover:underline"
                    >
                      Mapa
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={History} title="Historial de carga" description="Sesiones facturadas por Tesla (Supercargadores). Las cargas en casa no aparecen aquí.">
          {history.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : history.isError ? (
            <p className="text-sm text-amber-300/90">{errorMessage(history.error)}</p>
          ) : (history.data?.sessions.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">Tesla no reporta sesiones de carga facturadas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.data?.sessions.slice(0, 8).map((session) => (
                <li key={session.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                    <BatteryCharging className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{session.site ?? "Sesión de carga"}</p>
                    <p className="text-[11px] text-muted">{formatDate(session.startedAt)}{session.energyKwh !== null ? ` · ${session.energyKwh} kWh` : ""}</p>
                  </div>
                  {session.totalDue !== null ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {session.totalDue.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {session.currency ?? ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted">
        Solo lectura: TECLA LIVE no envía comandos al vehículo. Los datos se consultan como máximo cada 2 minutos (cargadores cada 10, historial cada 30) para cuidar el consumo de la Fleet API. Ubicación y datos del auto no se guardan en el servidor.
      </p>
    </div>
  );
}

function DetailSections({ detail }: { detail: TeslaDetail }) {
  const { summary, identity, charge, climate, body, tyres, drive, software, units } = detail;
  const charging = summary.charging === "charging";
  const openDoors = [
    body.doors.frontLeft && "delantera izquierda",
    body.doors.frontRight && "delantera derecha",
    body.doors.rearLeft && "trasera izquierda",
    body.doors.rearRight && "trasera derecha",
  ].filter(Boolean) as string[];
  const openWindows = [body.windows.frontLeft, body.windows.frontRight, body.windows.rearLeft, body.windows.rearRight].filter(Boolean).length;
  const tyreTone = (bar: number | null, warn: boolean) => (bar === null ? undefined : warn || bar < 2.5 ? "warn" : "ok");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section icon={BatteryCharging} title="Batería y carga" description="Nivel, autonomía, límite, potencia, energía añadida y programación.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Reading label="Batería" value={dash(summary.batteryPercent, "%")} hint={charge.usablePercent !== null ? `Utilizable ${charge.usablePercent}%` : undefined} tone={summary.batteryPercent !== null && summary.batteryPercent <= 20 ? "bad" : undefined} />
          <Reading label="Autonomía" value={dash(summary.rangeKm, " km")} hint={charge.estRangeKm !== null ? `Estimada ${charge.estRangeKm} km` : undefined} />
          <Reading label="Límite de carga" value={dash(summary.chargeLimitPercent, "%")} hint={charge.limitMaxPercent !== null ? `Máximo ${charge.limitMaxPercent}%` : undefined} />
          <Reading label="Estado" value={chargingLabel(summary)} tone={charging ? "ok" : undefined} />
          <Reading label="Potencia" value={charging ? dash(summary.chargerPowerKw, " kW") : "—"} hint={charge.voltage && charge.currentA ? `${charge.voltage} V · ${charge.currentA} A` : undefined} />
          <Reading label="Tiempo restante" value={summary.minutesToFull !== null ? `${summary.minutesToFull} min` : "—"} hint={charge.rateKmh !== null && charging ? `${charge.rateKmh} km/h de carga` : undefined} />
          <Reading label="Energía añadida" value={dash(charge.energyAddedKwh, " kWh")} hint={charge.rangeAddedKm !== null ? `${charge.rangeAddedKm} km añadidos` : undefined} />
          <Reading label="Puerto de carga" value={charge.portOpen === null ? "—" : charge.portOpen ? "Abierto" : "Cerrado"} hint={charge.portLatch ? `Seguro: ${charge.portLatch}` : undefined} />
          <Reading label="Cable" value={charge.cable ? charge.cable : "—"} hint={charge.fastCharger ? `Carga rápida ${charge.fastChargerType ?? ""}` : undefined} />
          <Reading label="Amperaje" value={charge.requestedAmps !== null ? `${charge.requestedAmps} A` : "—"} hint={charge.maxAmps !== null ? `Máximo ${charge.maxAmps} A` : undefined} />
          <Reading label="Programación" value={charge.scheduledMode ? charge.scheduledMode : "—"} hint={charge.scheduledStartMinutes !== null ? `Inicio ${minutesOfDay(charge.scheduledStartMinutes)}` : charge.scheduledDepartureMinutes !== null ? `Salida ${minutesOfDay(charge.scheduledDepartureMinutes)}` : undefined} />
          <Reading label="Batería" value={yesNo(charge.batteryHeater, "Calentando", "Sin calentar")} hint={charge.preconditioning ? "Preacondicionando" : undefined} />
        </div>
      </Section>

      <Section icon={Thermometer} title="Clima" description="Temperaturas, ajustes de cada lado, ventilador, asientos y desempañadores.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Reading label="Interior" value={summary.insideTempC !== null ? `${Math.round(summary.insideTempC)}°` : "—"} />
          <Reading label="Exterior" value={summary.outsideTempC !== null ? `${Math.round(summary.outsideTempC)}°` : "—"} />
          <Reading label="Clima" value={summary.climateOn ? "Encendido" : "Apagado"} hint={climate.keeperMode && climate.keeperMode !== "off" ? `Modo ${climate.keeperMode}` : undefined} tone={summary.climateOn ? "ok" : undefined} />
          <Reading label="Conductor" value={climate.driverSetC !== null ? `${climate.driverSetC}°` : "—"} />
          <Reading label="Pasajero" value={climate.passengerSetC !== null ? `${climate.passengerSetC}°` : "—"} />
          <Reading label="Ventilador" value={climate.fan !== null ? (climate.fan === 0 ? "Apagado" : `Nivel ${climate.fan}`) : "—"} hint={climate.auto ? "Automático" : undefined} />
          <Reading label="Asiento conductor" value={seatLabel(climate.seatHeaters.frontLeft)} />
          <Reading label="Asiento pasajero" value={seatLabel(climate.seatHeaters.frontRight)} />
          <Reading label="Volante" value={yesNo(climate.steeringHeater, "Calefactado", "Apagado")} />
          <Reading label="Desempañador" value={climate.frontDefrost || climate.rearDefrost ? [climate.frontDefrost && "delantero", climate.rearDefrost && "trasero"].filter(Boolean).join(" y ") : "Apagado"} />
          <Reading label="Protección de cabina" value={climate.cabinOverheatProtection ? climate.cabinOverheatProtection : "—"} />
        </div>
      </Section>

      <Section icon={DoorOpen} title="Carrocería y seguridad" description="Bloqueo, puertas, maleteros, ventanas y modos de protección.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Reading label="Bloqueo" value={summary.locked === null ? "—" : summary.locked ? "Bloqueado" : "Sin bloquear"} tone={summary.locked === false ? "warn" : "ok"} />
          <Reading label="Puertas" value={openDoors.length === 0 ? "Cerradas" : `${openDoors.length} abierta${openDoors.length > 1 ? "s" : ""}`} hint={openDoors.join(", ") || undefined} tone={openDoors.length ? "warn" : "ok"} />
          <Reading label="Maleteros" value={body.trunks.front || body.trunks.rear ? [body.trunks.front && "delantero", body.trunks.rear && "trasero"].filter(Boolean).join(" y ") + " abierto" : "Cerrados"} tone={body.trunks.front || body.trunks.rear ? "warn" : "ok"} />
          <Reading label="Ventanas" value={openWindows === 0 ? "Cerradas" : `${openWindows} abierta${openWindows > 1 ? "s" : ""}`} tone={openWindows ? "warn" : "ok"} />
          <Reading label="Centinela" value={summary.sentryMode === null ? "—" : summary.sentryMode ? "Activo" : "Apagado"} hint={body.sentryAvailable === false ? "No disponible" : undefined} />
          <Reading label="Modo valet" value={yesNo(body.valetMode, "Activo", "Apagado")} />
          <Reading label="Cámara" value={body.dashcam ? body.dashcam : "—"} />
          <Reading label="Alguien a bordo" value={yesNo(summary.userPresent)} />
          <Reading label="Arranque remoto" value={yesNo(body.remoteStart, "Activo", "Apagado")} />
        </div>
      </Section>

      <Section icon={Gauge} title="Llantas" description="Presión reportada por el auto (TPMS), en bar.">
        <div className="grid grid-cols-2 gap-2">
          <Reading label="Delantera izq." value={tyres.frontLeftBar !== null ? `${tyres.frontLeftBar.toFixed(1)} bar` : "—"} tone={tyreTone(tyres.frontLeftBar, tyres.warnings.frontLeft)} />
          <Reading label="Delantera der." value={tyres.frontRightBar !== null ? `${tyres.frontRightBar.toFixed(1)} bar` : "—"} tone={tyreTone(tyres.frontRightBar, tyres.warnings.frontRight)} />
          <Reading label="Trasera izq." value={tyres.rearLeftBar !== null ? `${tyres.rearLeftBar.toFixed(1)} bar` : "—"} tone={tyreTone(tyres.rearLeftBar, tyres.warnings.rearLeft)} />
          <Reading label="Trasera der." value={tyres.rearRightBar !== null ? `${tyres.rearRightBar.toFixed(1)} bar` : "—"} tone={tyreTone(tyres.rearRightBar, tyres.warnings.rearRight)} />
        </div>
        <p className="mt-3 text-[11px] text-muted">El auto solo actualiza la presión en marcha; en reposo puede mostrar la última lectura o ninguna.</p>
      </Section>

      <Section icon={Compass} title="Ubicación y marcha" description="Posición, rumbo y potencia según el GPS del auto.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Reading label="Marcha" value={summary.shiftState ? summary.shiftState : "P"} hint={summary.speedKmh !== null ? `${summary.speedKmh} km/h` : "Detenido"} />
          <Reading label="Rumbo" value={compassLabel(drive.heading)} hint={drive.heading !== null ? `${Math.round(drive.heading)}°` : undefined} />
          <Reading label="Potencia" value={drive.powerKw !== null ? `${drive.powerKw} kW` : "—"} />
          <Reading label="Odómetro" value={dash(summary.odometerKm, " km")} />
          <Reading label="GPS" value={summary.location ? `${summary.location.latitude.toFixed(4)}, ${summary.location.longitude.toFixed(4)}` : "—"} hint={drive.gpsAt ? `Fix ${formatDate(drive.gpsAt)}` : undefined} />
          <div className="flex items-center justify-center rounded-2xl border border-border bg-surface/40 px-3 py-3">
            {summary.location ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${summary.location.latitude},${summary.location.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <MapPin className="size-4" aria-hidden />
                Ver en el mapa
              </a>
            ) : (
              <span className="text-sm text-muted">Sin posición</span>
            )}
          </div>
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Vehículo y software" description="Identidad del auto, versión instalada y actualizaciones pendientes.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Reading label="Modelo" value={identity.model ?? "—"} hint={identity.trim ?? undefined} />
          <Reading label="VIN" value={identity.vin ? `…${identity.vin.slice(-6)}` : "—"} />
          <Reading label="Color" value={identity.exteriorColor ?? "—"} hint={identity.roof ? `Techo ${identity.roof}` : undefined} />
          <Reading label="Ruedas" value={identity.wheels ?? "—"} />
          <Reading label="Interior" value={identity.interior ?? "—"} hint={identity.chargePortType ? `Puerto ${identity.chargePortType}` : undefined} />
          <Reading label="Software" value={software.version ? software.version.split(" ")[0] ?? software.version : "—"} />
          <Reading
            label="Actualización"
            value={software.updateStatus ? software.updateStatus : "Al día"}
            hint={software.updateVersion ? `${software.updateVersion}${software.downloadPercent !== null ? ` · descarga ${software.downloadPercent}%` : ""}${software.installPercent !== null ? ` · instalación ${software.installPercent}%` : ""}` : undefined}
            tone={software.updateStatus ? "warn" : "ok"}
          />
          <Reading label="Unidades del auto" value={units.distance ? `${units.distance} · ${units.temperature ?? ""}` : "—"} hint={units.time24h === null ? undefined : units.time24h ? "Reloj 24 h" : "Reloj 12 h"} />
          <Reading label="Mercado" value={identity.euVehicle === null ? "—" : identity.euVehicle ? "Europa" : "América"} hint={identity.rightHandDrive ? "Volante a la derecha" : undefined} />
        </div>
      </Section>

      <Section icon={summary.locked ? Lock : LockOpen} title="Estado de la lectura" description="Cuándo se leyó y de dónde viene este dato." className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><Snowflake className="size-3.5" aria-hidden />Lectura de {formatDate(summary.observedAt)}{summary.cached ? " (caché del servidor)" : ""}</span>
          <span className="flex items-center gap-1.5"><Plug className="size-3.5" aria-hidden />Permisos: datos del vehículo, ubicación y gestión de carga</span>
          <span className="flex items-center gap-1.5"><Fan className="size-3.5" aria-hidden />Región {detail.units.distance ? "según el auto" : "NA"}</span>
        </div>
      </Section>
    </div>
  );
}
