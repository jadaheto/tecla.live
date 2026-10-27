import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRoom, publishCommand } from "@/lib/remote/rooms";
import { REMOTE_CODE, RemoteCommandSchema } from "@/lib/remote/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El celular envía una orden acotada al auto. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!REMOTE_CODE.test(upper)) return jsonError("INVALID_CODE", "Código inválido.", 400);
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`remote-command:${ip}`, 90, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas órdenes seguidas.", 429, true, rateLimitHeaders(limit));
  const room = getRoom(upper);
  if (!room) return jsonError("REMOTE_NOT_FOUND", "Este control remoto ya no está activo. Vuelve a escanear el código en el auto.", 404);
  const parsed = RemoteCommandSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("INVALID_COMMAND", "Orden no reconocida.", 400);
  if (room.listeners.size === 0) return jsonError("CAR_OFFLINE", "El auto no está conectado ahora mismo.", 409, true);
  const envelope = publishCommand(room, parsed.data);
  logger.info("remote.command", { code: upper, type: parsed.data.type });
  return jsonOk({ ok: true, id: envelope.id });
}
