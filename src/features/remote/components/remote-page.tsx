"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Compass, Gauge, Home, Mic, Music2, Orbit, Pause, Play, Podcast, Radio, Send, SkipForward, TvMinimalPlay, Volume1, Volume2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import type { RemoteCommand, RemotePublicRoom, RemoteScreen } from "@/lib/remote/schema";
import { cn } from "@/lib/utils";

const SCREENS: Array<{ id: RemoteScreen; label: string; icon: typeof Home }> = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "youtube", label: "Videos", icon: TvMinimalPlay },
  { id: "music", label: "Spotify", icon: Music2 },
  { id: "radio", label: "Radio", icon: Radio },
  { id: "podcasts", label: "Podcasts", icon: Podcast },
  { id: "navigate", label: "Navegar", icon: Compass },
  { id: "drive", label: "Drive", icon: Gauge },
];

const STYLE_ACCENT: Record<string, string> = {
  tecla: "#ff5a3c",
  cyberpunk: "#fcee0a",
  kitt: "#ff2a2a",
  roadster: "#ff2b2b",
};

/**
 * Pantalla del celular: botones grandes para controlar el auto. No requiere
 * cuenta: el código del QR es la llave, y solo permite las órdenes del
 * contrato (nada de enlaces ni texto ejecutable).
 */
export function RemotePage({ code }: { code: string }) {
  const [text, setText] = React.useState("");
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const room = useQuery({
    queryKey: ["remote-room", code],
    queryFn: () => apiFetch<RemotePublicRoom>(`/api/remote/${code}`),
    refetchInterval: 3_000,
    retry: 1,
  });
  const send = useMutation({
    mutationFn: (command: RemoteCommand) =>
      apiFetch<{ ok: boolean }>(`/api/remote/${code}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }),
    onSuccess: () => {
      setFeedback(null);
      window.setTimeout(() => void room.refetch(), 600);
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : "No se pudo enviar la orden."),
  });

  const state = room.data?.state ?? null;
  const alive = room.data?.alive ?? false;
  const online = alive && (room.data?.carConnected ?? false);
  const accent = STYLE_ACCENT[state?.style ?? "tecla"] ?? STYLE_ACCENT.tecla;
  const busy = send.isPending;

  function dispatch(command: RemoteCommand) {
    if (busy) return;
    if (navigator.vibrate) navigator.vibrate(12);
    send.mutate(command);
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-4 bg-[#070709] px-4 pb-10 pt-6 text-white"
      style={{ ["--remote-accent" as string]: accent }}
    >
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">TECLA LIVE · Control remoto</p>
          <p className="mt-1 font-mono text-lg tracking-[0.3em]">{code}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
            online ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/55",
          )}
        >
          <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-white/35")} />
          {room.isLoading ? "Buscando" : online ? "Auto conectado" : alive ? "Auto desconectado" : "Código caducado"}
        </span>
      </header>

      {!alive && !room.isLoading ? (
        <section className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100/90">
          Este código ya no está activo. En el auto, abre «Control remoto» en TECLA LIVE y escanea el QR nuevo.
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
          {state?.kind === "spotify" ? "Spotify" : state?.kind === "radio" ? "Radio" : state?.kind ? "Reproduciendo" : "En el auto"}
        </p>
        <p className="mt-1 truncate text-lg font-semibold">{state?.title ?? "Nada sonando"}</p>
        <p className="truncate text-[12px] text-white/55">{state?.subtitle ?? (state ? `Pantalla ${state.screen}` : "Esperando al auto…")}</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <RemoteButton label={state?.isPlaying ? "Pausar" : "Reproducir"} onClick={() => dispatch({ type: state?.isPlaying ? "pause" : "play" })} disabled={!online || busy} accent={accent}>
            {state?.isPlaying ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
          </RemoteButton>
          <RemoteButton label="Siguiente" onClick={() => dispatch({ type: "next" })} disabled={!online || busy}>
            <SkipForward className="size-6 fill-current" aria-hidden />
          </RemoteButton>
          <RemoteButton label="Bajar volumen" onClick={() => dispatch({ type: "volume", delta: -10 })} disabled={!online || busy}>
            <Volume1 className="size-6" aria-hidden />
          </RemoteButton>
          <RemoteButton label="Subir volumen" onClick={() => dispatch({ type: "volume", delta: 10 })} disabled={!online || busy}>
            <Volume2 className="size-6" aria-hidden />
          </RemoteButton>
        </div>
        {state ? (
          <p className="mt-3 text-[11px] text-white/45">Volumen {state.volume}% · estilo {state.style}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Pedirle a TECLA AI</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const clean = text.trim();
            if (!clean) return;
            dispatch({ type: "ask", text: clean.slice(0, 240) });
            setText("");
          }}
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Pon salsa en Spotify…"
            maxLength={240}
            disabled={!online}
            aria-label="Orden para TECLA AI"
            className="min-h-12 flex-1 rounded-2xl border border-white/15 bg-black/40 px-4 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2"
            style={{ ["--tw-ring-color" as string]: accent }}
          />
          <button
            type="submit"
            disabled={!online || busy || !text.trim()}
            aria-label="Enviar a TECLA AI"
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-black disabled:opacity-40"
            style={{ background: accent }}
          >
            <Send className="size-5" aria-hidden />
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/45">
          <Mic className="size-3.5" aria-hidden />
          Se envía como texto al asistente del auto; la respuesta suena allá.
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Abrir en el auto</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SCREENS.map((screen) => (
            <RemoteButton key={screen.id} label={screen.label} caption onClick={() => dispatch({ type: "open", screen: screen.id })} disabled={!online || busy}>
              <screen.icon className="size-5" aria-hidden />
            </RemoteButton>
          ))}
          <RemoteButton label={state?.ambient ? "Salir ambiente" : "Pantalla ambiente"} caption onClick={() => dispatch({ type: "ambient", on: !state?.ambient })} disabled={!online || busy} accent={state?.ambient ? accent : undefined}>
            <Orbit className="size-5" aria-hidden />
          </RemoteButton>
        </div>
      </section>

      {feedback ? (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-[13px] text-red-200">
          {feedback}
        </p>
      ) : null}

      <p className="mt-auto text-center text-[10px] leading-relaxed text-white/35">
        El código deja de funcionar cuando el auto cierra el control remoto. No se guarda nada de tu celular.
      </p>
    </main>
  );
}

function RemoteButton({
  label,
  caption = false,
  children,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  caption?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.06] text-white transition-transform active:scale-95 disabled:opacity-40",
        accent && "text-black",
      )}
      style={accent ? { background: accent, borderColor: accent } : undefined}
    >
      {children}
      {caption ? <span className="text-[10px] font-medium">{label}</span> : null}
    </button>
  );
}
