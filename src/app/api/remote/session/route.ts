import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { ROOM_TTL_MS, resumeOrCreateRoom } from "@/lib/remote/rooms";
import { RemoteSessionRequestSchema, type RemoteSessionResponse } from "@/lib/remote/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El auto abre (o retoma) su sala de control remoto. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`remote-session:${ip}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas sesiones de control remoto. Espera un momento.", 429, true, rateLimitHeaders(limit));
  }
  const parsed = RemoteSessionRequestSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return jsonError("INVALID_BODY", "Solicitud inválida.", 400);
  const room = resumeOrCreateRoom(parsed.data.code, parsed.data.token);
  if (!room) return jsonError("REMOTE_FULL", "No hay cupo para más controles remotos ahora.", 503, true);
  const body: RemoteSessionResponse = {
    code: room.code,
    token: room.token,
    expiresAt: new Date(room.touchedAt + ROOM_TTL_MS).toISOString(),
  };
  return jsonOk(body);
}
