import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRoom } from "@/lib/remote/rooms";
import { REMOTE_CODE, type RemotePublicRoom } from "@/lib/remote/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El celular consulta si la sala existe y qué está sonando en el auto. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  if (!REMOTE_CODE.test(upper)) return jsonError("INVALID_CODE", "Código inválido.", 400);
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`remote-poll:${ip}`, 120, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas consultas.", 429, true, rateLimitHeaders(limit));
  const room = getRoom(upper);
  const body: RemotePublicRoom = room
    ? { alive: true, carConnected: room.listeners.size > 0, state: room.state, updatedAt: room.stateAt ? new Date(room.stateAt).toISOString() : null }
    : { alive: false, carConnected: false, state: null, updatedAt: null };
  return jsonOk(body);
}
