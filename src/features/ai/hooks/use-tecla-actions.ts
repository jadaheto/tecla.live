"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  TOOL_SCHEMAS,
  type ToolName,
} from "@/features/ai/tools/schemas";
import { getMediaController } from "@/features/media/player-bridge";
import { APP_BY_ID, ALLOWED_APP_IDS } from "@/lib/catalog";
import { buildNavigateHref } from "@/lib/integrations/navigation";
import { usePreferences } from "@/stores/preferences";
import { useLibrary } from "@/stores/library";
import { usePlayer } from "@/stores/player";
import { useAiMemory } from "@/stores/ai-memory";
import type { AiActionExecution, AiPendingAction } from "@/features/ai/types";
import type { MediaKind } from "@/types";

type ExecutionOutcome = {
  ok: boolean;
  content: unknown;
  summary: string;
};

function defaultHref(kind: MediaKind, providerId: string): string {
  switch (kind) {
    case "youtube":
      return `/watch/${providerId}`;
    case "radio":
      return "/radio";
    case "podcast":
      return "/podcasts";
    case "iptv":
      return "/iptv";
    case "channel":
      return "/youtube";
    default:
      return "/";
  }
}

function result(errorCode: string, message: string): ExecutionOutcome {
  return {
    ok: false,
    content: { ok: false, error: { code: errorCode, message } },
    summary: message,
  };
}

export function useTeclaActions() {
  const router = useRouter();

  return React.useCallback(
    async (actions: AiPendingAction[]): Promise<AiActionExecution[]> => {
      const executions: AiActionExecution[] = [];

      for (const action of actions) {
        const name = action.name as ToolName;
        const schema = TOOL_SCHEMAS[name];

        if (!schema) {
          executions.push({
            toolCallId: action.toolCallId,
            name,
            ok: false,
            content: JSON.stringify({ ok: false, error: "UNKNOWN_TOOL" }),
            summary: "Herramienta desconocida.",
          });
          continue;
        }

        const parsed = schema.safeParse(action.arguments);
        if (!parsed.success) {
          executions.push({
            toolCallId: action.toolCallId,
            name,
            ok: false,
            content: JSON.stringify({ ok: false, error: "INVALID_ARGUMENTS" }),
            summary: "Los argumentos de la acción no son válidos.",
          });
          continue;
        }

        let outcome: ExecutionOutcome;
        try {
          outcome = await executeAction(name, parsed.data, router);
        } catch {
          outcome = result("ACTION_FAILED", "La acción no se pudo completar.");
        }

        executions.push({
          toolCallId: action.toolCallId,
          name,
          ok: outcome.ok,
          content: JSON.stringify(outcome.content),
          summary: outcome.summary,
        });
      }

      return executions;
    },
    [router],
  );
}

async function executeAction(
  name: ToolName,
  args: unknown,
  router: ReturnType<typeof useRouter>,
): Promise<ExecutionOutcome> {
  switch (name) {
    case "play_youtube": {
      const input = TOOL_SCHEMAS.play_youtube.parse(args);
      usePlayer.getState().setCurrent({
        kind: "youtube",
        id: input.videoId,
        title: input.title ?? "Video de YouTube",
        href: `/watch/${input.videoId}`,
      });
      router.push(`/watch/${input.videoId}`);
      return {
        ok: true,
        content: {
          ok: true,
          message: "Reproductor abierto con el video solicitado.",
          videoId: input.videoId,
        },
        summary: `Abriendo «${input.title ?? "video de YouTube"}»`,
      };
    }

    case "pause_media": {
      const controller = getMediaController();
      if (!controller) {
        return result("NO_ACTIVE_PLAYER", "No hay un reproductor activo de TECLA LIVE.");
      }
      const outcome = await controller.pause();
      return { ok: outcome.ok, content: outcome, summary: outcome.message };
    }

    case "resume_media": {
      const controller = getMediaController();
      if (!controller) {
        return result("NO_ACTIVE_PLAYER", "No hay un reproductor activo de TECLA LIVE.");
      }
      const outcome = await controller.play();
      return { ok: outcome.ok, content: outcome, summary: outcome.message };
    }

    case "next_video": {
      const controller = getMediaController();
      if (!controller) {
        return result("NO_ACTIVE_PLAYER", "No hay un reproductor activo de TECLA LIVE.");
      }
      const outcome = await controller.next();
      return { ok: outcome.ok, content: outcome, summary: outcome.message };
    }

    case "add_favorite": {
      const input = TOOL_SCHEMAS.add_favorite.parse(args);
      useLibrary.getState().addFavorite({
        kind: input.kind,
        providerId: input.providerId,
        title: input.title,
        subtitle: input.subtitle,
        imageUrl: input.imageUrl,
        href: defaultHref(input.kind, input.providerId),
      });
      return {
        ok: true,
        content: { ok: true, message: "Guardado en favoritos." },
        summary: `Guardado «${input.title}» en favoritos`,
      };
    }

    case "show_favorites": {
      router.push("/favorites");
      return {
        ok: true,
        content: { ok: true, message: "Abriendo la biblioteca de favoritos." },
        summary: "Abriendo favoritos",
      };
    }

    case "open_app": {
      const input = TOOL_SCHEMAS.open_app.parse(args);
      if (!ALLOWED_APP_IDS.includes(input.appId)) {
        return result("APP_NOT_ALLOWED", "Esa aplicación no está en la lista permitida.");
      }
      const app = APP_BY_ID.get(input.appId);
      if (!app) return result("APP_NOT_FOUND", "No encontramos esa aplicación.");
      if (app.external) {
        const opened = window.open(app.href, "_blank", "noopener,noreferrer");
        if (!opened) {
          return result(
            "POPUP_BLOCKED",
            "El navegador bloqueó la apertura de la aplicación. Ábrela manualmente desde Accesos rápidos.",
          );
        }
        return {
          ok: true,
          content: { ok: true, message: "Aplicación externa abierta en una pestaña nueva." },
          summary: `Abriendo ${app.name} en una pestaña nueva`,
        };
      }
      router.push(app.href);
      return {
        ok: true,
        content: { ok: true, message: `Abriendo ${app.name}.` },
        summary: `Abriendo ${app.name}`,
      };
    }

    case "search_waze": {
      const input = TOOL_SCHEMAS.search_waze.parse(args);
      router.push(buildNavigateHref("waze", input.destination));
      return {
        ok: true,
        content: {
          ok: true,
          message: "Búsqueda de Waze preparada en TECLA LIVE.",
          destination: input.destination,
        },
        summary: `Preparando Waze hacia «${input.destination}»`,
      };
    }

    case "open_google_maps": {
      const input = TOOL_SCHEMAS.open_google_maps.parse(args);
      router.push(buildNavigateHref("maps", input.destination));
      return {
        ok: true,
        content: {
          ok: true,
          message: "Búsqueda de Google Maps preparada.",
          destination: input.destination,
        },
        summary: `Buscando «${input.destination}» en Google Maps`,
      };
    }

    case "set_theme": {
      const input = TOOL_SCHEMAS.set_theme.parse(args);
      usePreferences.getState().setPreferences({ theme: input.theme });
      return {
        ok: true,
        content: { ok: true, message: `Tema ${input.theme} aplicado.` },
        summary: `Tema cambiado a ${input.theme}`,
      };
    }

    case "set_display_mode": {
      const input = TOOL_SCHEMAS.set_display_mode.parse(args);
      usePreferences.getState().setPreferences({ displayMode: input.mode });
      return {
        ok: true,
        content: { ok: true, message: `Modo ${input.mode} aplicado.` },
        summary: `Modo de pantalla: ${input.mode}`,
      };
    }

    case "request_fullscreen": {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          return {
            ok: true,
            content: { ok: true, message: "Se salió de pantalla completa." },
            summary: "Saliendo de pantalla completa",
          };
        }
        if (!document.fullscreenEnabled) {
          return result(
            "FULLSCREEN_UNSUPPORTED",
            "Este navegador no permite pantalla completa.",
          );
        }
        await document.documentElement.requestFullscreen();
        return {
          ok: true,
          content: { ok: true, message: "Pantalla completa activada." },
          summary: "Pantalla completa activada",
        };
      } catch {
        return result(
          "FULLSCREEN_BLOCKED",
          "El navegador bloqueó la pantalla completa. Inténtalo con el botón de pantalla completa.",
        );
      }
    }

    case "play_radio": {
      const input = TOOL_SCHEMAS.play_radio.parse(args);
      router.push(`/radio?station=${encodeURIComponent(input.stationId)}`);
      return {
        ok: true,
        content: {
          ok: true,
          message: "Emisora abierta en Radio. El navegador puede requerir un toque para reproducir.",
        },
        summary: "Abriendo la emisora en Radio",
      };
    }

    case "get_playback_state": {
      const controller = getMediaController();
      if (!controller) {
        return {
          ok: true,
          content: { ok: true, active: false, message: "No hay reproductor activo." },
          summary: "No hay reproducción activa",
        };
      }
      const snapshot = controller.getSnapshot();
      return {
        ok: true,
        content: { ok: true, playback: snapshot },
        summary: snapshot.title ? `Reproduciendo «${snapshot.title}»` : "Estado consultado",
      };
    }

    case "remember_preference": {
      const input = TOOL_SCHEMAS.remember_preference.parse(args);
      if (!usePreferences.getState().memoryConsent) {
        return result(
          "MEMORY_NOT_CONSENTED",
          "El usuario no ha activado la memoria de preferencias. Pregúntale si quiere activarla en Ajustes; no la guardes.",
        );
      }
      useAiMemory.getState().remember(input.key, input.value);
      return {
        ok: true,
        content: { ok: true, message: "Preferencia recordada en este navegador." },
        summary: `Recordé: ${input.value}`,
      };
    }

    case "open_spotify": {
      router.push("/music");
      return {
        ok: true,
        content: { ok: true, message: "Abriendo la sección de música y Spotify." },
        summary: "Abriendo Música y Spotify",
      };
    }

    case "search_youtube":
    case "search_radio":
    case "search_podcasts":
    case "get_weather":
    case "spotify_control": {
      return result(
        "SERVER_TOOL_MISROUTED",
        "Esta herramienta debe ejecutarse en el servidor.",
      );
    }

    default: {
      return result("UNKNOWN_TOOL", "Herramienta no disponible.");
    }
  }
}
