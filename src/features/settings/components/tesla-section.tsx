"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingRow, StatusDot } from "@/features/settings/components/settings-ui";
import { chargingLabel, useTeslaStatus, useTeslaVehicle } from "@/features/tesla/hooks";
import { apiFetch, errorMessage } from "@/lib/http";
import { toast } from "@/stores/toast";

const FEEDBACK: Record<string, { title: string; variant: "success" | "error" | "info" }> = {
  connected: { title: "Tu Tesla quedó vinculado.", variant: "success" },
  login_required: { title: "Inicia sesión en TECLA LIVE antes de vincular tu Tesla.", variant: "info" },
  error: { title: "No pudimos vincular tu Tesla.", variant: "error" },
};

/**
 * Ajustes → Mi Tesla: estado de la Fleet API, vinculación de la cuenta,
 * registro del dominio ante Tesla (una vez) y última lectura del vehículo.
 */
export function TeslaSection() {
  const status = useTeslaStatus();
  const connected = status.data?.connected ?? false;
  const vehicle = useTeslaVehicle(connected);
  const queryClient = useQueryClient();
  const [partnerResult, setPartnerResult] = React.useState<string | null>(null);

  // Resultado del callback (?tesla=connected|error&reason=…), sin useSearchParams para no exigir Suspense.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("tesla");
    if (!result) return;
    const feedback = FEEDBACK[result];
    if (feedback) {
      toast({ title: feedback.title, description: result === "error" ? `Motivo: ${params.get("reason") ?? "desconocido"}` : undefined, variant: feedback.variant });
    }
    params.delete("tesla");
    params.delete("reason");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    void queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
  }, [queryClient]);

  const disconnect = useMutation({
    mutationFn: () => apiFetch("/api/tesla/disconnect", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Tesla desvinculado", variant: "info" });
      void queryClient.invalidateQueries({ queryKey: ["tesla-status"] });
      queryClient.removeQueries({ queryKey: ["tesla-vehicle"] });
    },
    onError: (error) => toast({ title: errorMessage(error), variant: "error" }),
  });

  const partner = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; status: number; detail: string }>("/api/tesla/partner", { method: "POST" }),
    onSuccess: (result) => setPartnerResult(`${result.ok ? "Registrado" : "Tesla respondió"} (HTTP ${result.status}): ${result.detail || "sin detalle"}`),
    onError: (error) => setPartnerResult(errorMessage(error)),
  });

  const configured = status.data?.configured ?? false;
  const authenticated = status.data?.authenticated ?? false;

  return (
    <>
      <SettingRow
        title="Estado"
        description={
          !configured
            ? "Falta configurar TESLA_CLIENT_ID y TESLA_CLIENT_SECRET en el servidor (y TOKEN_ENCRYPTION_KEY con base de datos)."
            : !authenticated
              ? "Inicia sesión en TECLA LIVE: los tokens de Tesla se guardan cifrados por usuario."
              : connected
                ? `Cuenta vinculada · dominio registrado: ${status.data?.domain} · región ${status.data?.region.toUpperCase()}`
                : `Lista para vincular · dominio registrado: ${status.data?.domain}`
        }
      >
        <div className="flex items-center gap-2">
          <StatusDot active={connected} />
          <Badge variant={connected ? "success" : "outline"}>{connected ? "Vinculado" : configured ? "Sin vincular" : "No configurado"}</Badge>
        </div>
      </SettingRow>

      <SettingRow
        title="Cuenta de Tesla"
        description="Autorizas a TECLA LIVE a leer batería, autonomía, carga, temperatura y bloqueo. Solo lectura: TECLA no envía comandos al vehículo en esta fase."
      >
        {connected ? (
          <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
            <Unplug className="size-3.5" aria-hidden />
            Desvincular
          </Button>
        ) : (
          <a
            href="/api/tesla/login"
            aria-disabled={!configured || !authenticated}
            className={`flex min-h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground ${!configured || !authenticated ? "pointer-events-none opacity-50" : ""}`}
          >
            <Car className="size-3.5" aria-hidden />
            Vincular mi Tesla
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </SettingRow>

      {connected ? (
        <SettingRow
          title="Última lectura"
          description={
            vehicle.data
              ? vehicle.data.asleep
                ? `${vehicle.data.name ?? "Vehículo"} durmiendo. Despiértalo desde la tarjeta «Mi Tesla» de Inicio.`
                : `${vehicle.data.name ?? "Vehículo"} · ${vehicle.data.batteryPercent ?? "—"}% · ${vehicle.data.rangeKm ?? "—"} km · ${chargingLabel(vehicle.data)}${vehicle.data.insideTempC !== null ? ` · ${Math.round(vehicle.data.insideTempC)}° dentro` : ""}`
              : vehicle.error
                ? errorMessage(vehicle.error)
                : "Consultando…"
          }
        >
          <Button variant="glass" size="sm" onClick={() => void vehicle.refetch()} loading={vehicle.isFetching}>
            <RefreshCw className="size-3.5" aria-hidden />
            Consultar
          </Button>
        </SettingRow>
      ) : null}

      <SettingRow
        title="Registro del dominio ante Tesla"
        description={`Una sola vez, después de subir la llave pública a https://${status.data?.domain ?? "sinapsia.co"}/.well-known/appspecific/com.tesla.3p.public-key.pem. Tesla exige este paso antes de aceptar lecturas del vehículo.${partnerResult ? ` Resultado: ${partnerResult}` : ""}`}
      >
        <Button variant="glass" size="sm" onClick={() => partner.mutate()} loading={partner.isPending} disabled={!configured || !authenticated}>
          Registrar ahora
        </Button>
      </SettingRow>
    </>
  );
}
