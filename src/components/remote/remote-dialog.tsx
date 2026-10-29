"use client";

import * as React from "react";
import QRCode from "qrcode";
import { RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { REMOTE_STORAGE_KEY, remoteUrl, useRemoteSession } from "@/features/remote/remote-session";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

/**
 * Diálogo del control remoto: interruptor, código QR y código corto para
 * que un pasajero controle música, pantallas y TECLA AI desde su celular.
 */
export function RemoteDialog() {
  const open = useUi((state) => state.remoteOpen);
  const setOpen = useUi((state) => state.setRemoteOpen);
  const enabled = usePreferences((state) => state.remoteControl);
  const setPreferences = usePreferences((state) => state.setPreferences);
  const session = useRemoteSession();
  const [qr, setQr] = React.useState<string | null>(null);
  const url = session.code && typeof window !== "undefined" ? remoteUrl(session.code, window.location.origin) : null;

  // Abrir el diálogo desde la cabecera ya expresa la intención: enciende el control
  // remoto para que el QR aparezca sin buscar el interruptor (se puede apagar aquí mismo).
  React.useEffect(() => {
    if (open && !usePreferences.getState().remoteControl) setPreferences({ remoteControl: true });
  }, [open, setPreferences]);

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  function renew() {
    try {
      sessionStorage.removeItem(REMOTE_STORAGE_KEY);
    } catch {
      // nada que borrar
    }
    setPreferences({ remoteControl: false });
    window.setTimeout(() => setPreferences({ remoteControl: true }), 50);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby="remote-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-6 text-accent" aria-hidden />
            Control remoto
          </DialogTitle>
          <DialogDescription id="remote-description">
            Un pasajero escanea el código con su celular y controla la música, abre pantallas y le pide cosas a TECLA AI sin instalar nada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium">Permitir control remoto</p>
            <p className="text-[11px] text-muted">
              {session.status === "online"
                ? "Conectado · esperando órdenes"
                : session.status === "connecting"
                  ? "Conectando…"
                  : session.status === "error"
                    ? session.error ?? "No se pudo conectar"
                    : "Apagado"}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={(checked) => setPreferences({ remoteControl: checked })} aria-label="Permitir control remoto" />
        </div>

        {enabled ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
            <div className={cn("flex aspect-square items-center justify-center rounded-3xl bg-white p-3", !qr && "animate-pulse")}>
              {qr && url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`Código QR para ${url}`} className="size-full" />
              ) : session.status === "error" ? (
                <p className="px-3 text-center text-[12px] leading-relaxed text-red-700">{session.error ?? "No se pudo abrir la sala"}</p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Código</p>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.3em]">{session.code ?? "······"}</p>
              <p className="mt-2 break-all text-[12px] text-muted">{url ?? "Generando enlace…"}</p>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                El código vale mientras esta pantalla siga abierta (hasta 3 horas sin uso). Solo acepta órdenes conocidas: reproducir, pausar, siguiente, volumen, abrir pantallas, pantalla ambiente, estilo y preguntas a TECLA AI.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={renew}>
                <RefreshCw className="size-3.5" aria-hidden />
                Generar código nuevo
              </Button>
            </div>
          </div>
        ) : null}
        {session.lastCommand ? (
          <p className="mt-4 text-[11px] text-muted">Última orden: {session.lastCommand}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
