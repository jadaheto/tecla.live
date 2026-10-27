import { authorizeRoom, subscribe } from "@/lib/remote/rooms";
import { REMOTE_CODE, REMOTE_TOKEN } from "@/lib/remote/schema";
import { jsonError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 20_000;

/** El auto recibe las órdenes del celular por Server-Sent Events. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!REMOTE_CODE.test(upper) || !REMOTE_TOKEN.test(token)) return jsonError("INVALID_CODE", "Código inválido.", 400);
  const room = authorizeRoom(upper, token);
  if (!room) return jsonError("REMOTE_NOT_FOUND", "Sala no encontrada o caducada.", 404);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // El cliente cerró la conexión.
        }
      };
      send("ready", { code: room.code });
      unsubscribe = subscribe(room, (envelope) => send("command", envelope));
      heartbeat = setInterval(() => send("ping", { at: Date.now() }), HEARTBEAT_MS);
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
