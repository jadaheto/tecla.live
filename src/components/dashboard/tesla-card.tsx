"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BatteryCharging, BatteryMedium, Car, Lock, LockOpen, MoonStar, RefreshCw, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoloCar } from "@/components/holo/holo-car";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { chargingLabel, useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";

/**
 * «Mi Tesla» en Inicio: batería, autonomía, carga, temperatura y bloqueo
 * leídos de la Fleet API. Si el auto duerme no se despierta solo: el botón
 * lo pide de forma explícita porque gasta batería. Sin cuenta vinculada,
 * invita a hacerlo en Ajustes; sin configurar, no se muestra.
 */
export function TeslaCard() {
  const status = useTeslaStatus();
  const connected = status.data?.connected ?? false;
  const vehicle = useTeslaVehicle(connected);
  const queryClient = useQueryClient();
  const wake = useMutation({
    mutationFn: () => apiFetch<{ state: string | null }>("/api/tesla/wake", { method: "POST" }),
    onSuccess: () => {
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["tesla-vehicle"] }), 8_000);
    },
  });
  const refresh = useMutation({
    mutationFn: () => apiFetch("/api/tesla/vehicle?refresh=1"),
    onSuccess: (data) => queryClient.setQueryData(["tesla-vehicle"], data),
  });

  if (!status.data?.configured) return null;

  if (!connected) {
    return (
      <Card className="flex min-h-[188px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Mi Tesla</p>
            <p className="mt-1 text-sm font-medium">Batería y carga en tiempo real</p>
          </div>
          <Car className="size-6 text-muted" aria-hidden />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          {status.data.authenticated
            ? "Vincula tu cuenta de Tesla para ver batería, autonomía, estado de carga y temperatura aquí y preguntárselo a TECLA AI."
            : "Inicia sesión en TECLA LIVE y vincula tu cuenta de Tesla para ver el estado del auto."}
        </p>
        <Link href="/settings#mi-tesla" className="mt-3 text-[12px] font-medium text-accent hover:underline">
          {status.data.authenticated ? "Vincular mi Tesla" : "Ir a Ajustes"}
        </Link>
      </Card>
    );
  }

  if (vehicle.isLoading) {
    return (
      <Card className="min-h-[188px] p-5">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-6 h-14 w-28 rounded-2xl" />
        <Skeleton className="mt-5 h-4 w-40 rounded-full" />
      </Card>
    );
  }

  const data = vehicle.data;
  if (vehicle.isError || !data) {
    return (
      <Card className="flex min-h-[188px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">Mi Tesla</p>
          <Car className="size-6 text-muted" aria-hidden />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          {vehicle.error instanceof Error ? vehicle.error.message : "No pudimos consultar tu Tesla."}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="subtle" size="sm" onClick={() => void vehicle.refetch()} loading={vehicle.isFetching}>
            <RefreshCw className="size-3.5" aria-hidden />
            Reintentar
          </Button>
          <Link href="/settings#mi-tesla" className="text-[11px] text-muted hover:text-foreground">
            Ajustes
          </Link>
        </div>
      </Card>
    );
  }

  if (data.asleep) {
    return (
      <Card className="flex min-h-[188px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Mi Tesla</p>
            <p className="mt-1 truncate text-sm font-medium">{data.name ?? "Tu Tesla"}</p>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted">
            <MoonStar className="size-6" aria-hidden />
          </span>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          El auto está durmiendo. Despertarlo consume un poco de batería; hazlo solo si quieres ver el estado ahora.
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Button variant="subtle" size="sm" onClick={() => wake.mutate()} loading={wake.isPending} disabled={wake.isSuccess}>
            {wake.isSuccess ? "Despertando…" : "Despertar"}
          </Button>
          {wake.isError ? <span className="text-[11px] text-red-400">{wake.error instanceof Error ? wake.error.message : "No se pudo"}</span> : null}
        </div>
      </Card>
    );
  }

  const charging = data.charging === "charging";
  const battery = data.batteryPercent ?? 0;

  return (
    <Card className="relative min-h-[188px] overflow-hidden p-5">
      <div className={cn("absolute -right-12 -top-16 size-56 rounded-full blur-2xl", charging ? "bg-gradient-to-br from-emerald-400/25 via-emerald-400/10 to-transparent" : "bg-gradient-to-br from-[#5eead4]/20 via-[#5eead4]/5 to-transparent")} />
      <HoloCar
        width={190}
        height={110}
        intensity={charging ? 1.6 : 1}
        color={charging ? "#34d399" : battery <= 20 ? "#f87171" : undefined}
        className="pointer-events-none absolute -right-3 -top-1 opacity-90"
        label={`Holograma de ${data.name ?? "tu Tesla"}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <Car className="size-3" aria-hidden />
            Mi Tesla
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-foreground/90">{data.name ?? "Tu Tesla"}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30", charging ? "text-emerald-300" : "text-[#5eead4]")}>
          {charging ? <BatteryCharging className="size-4" aria-hidden /> : <BatteryMedium className="size-4" aria-hidden />}
        </span>
      </div>

      <div className="relative mt-4 flex items-end gap-3">
        <span className="text-display text-[3.4rem] leading-none tabular-nums">{data.batteryPercent ?? "—"}%</span>
        <div className="pb-1.5">
          <p className="text-sm font-medium text-foreground">{data.rangeKm !== null ? `${data.rangeKm} km de autonomía` : "Autonomía no disponible"}</p>
          <p className="mt-0.5 text-[11px] text-muted">{chargingLabel(data)}{charging && data.chargerPowerKw ? ` · ${data.chargerPowerKw} kW` : ""}</p>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width] duration-700", charging ? "bg-emerald-400" : battery <= 20 ? "bg-red-400" : "bg-[#5eead4]")} style={{ width: `${Math.max(2, Math.min(100, battery))}%` }} />
      </div>

      <div className="relative mt-3 flex items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
        {data.insideTempC !== null ? (
          <span className="flex items-center gap-1.5">
            <Thermometer className="size-3.5" aria-hidden />
            {Math.round(data.insideTempC)}° dentro{data.climateOn ? " · clima activo" : ""}
          </span>
        ) : null}
        {data.locked !== null ? (
          <span className="flex items-center gap-1.5">
            {data.locked ? <Lock className="size-3.5" aria-hidden /> : <LockOpen className="size-3.5" aria-hidden />}
            {data.locked ? "Bloqueado" : "Sin bloquear"}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label="Actualizar estado del Tesla"
          className="ml-auto flex items-center gap-1 text-[10px] hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", refresh.isPending && "animate-spin")} aria-hidden />
          {data.cached ? "Actualizar" : "Al día"}
        </button>
      </div>
    </Card>
  );
}
