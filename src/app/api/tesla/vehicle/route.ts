import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { getTeslaSnapshot, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado del vehículo (batería, carga, clima, bloqueo). `?refresh=1` salta la caché de 2 minutos. */
export async function GET(request: Request) {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para ver tu Tesla.", 401);
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  if (force) {
    const limit = consumeRateLimit(`tesla-refresh:${claims.userId}`, 6, 60_000);
    if (!limit.ok) return jsonError("RATE_LIMITED", "Espera un momento antes de volver a consultar el auto.", 429, true, rateLimitHeaders(limit));
  }
  try {
    return jsonOk(await getTeslaSnapshot(claims.userId, { force }));
  } catch (error) {
    if (error instanceof TeslaError) return jsonError(error.code, error.message, error.status, error.status >= 500 || error.status === 429);
    logger.error("tesla.vehicle_unexpected", { error });
    return jsonError("TESLA_UNEXPECTED", "No pudimos consultar tu Tesla.", 502, true);
  }
}
