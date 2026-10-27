import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { getTeslaChargingHistory, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Últimas sesiones de carga facturadas por Tesla (caché de 30 minutos). */
export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para ver el historial de carga.", 401);
  const limit = consumeRateLimit(`tesla-history:${claims.userId}`, 6, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas consultas del historial.", 429, true, rateLimitHeaders(limit));
  try {
    return jsonOk({ sessions: await getTeslaChargingHistory(claims.userId) });
  } catch (error) {
    if (error instanceof TeslaError) return jsonError(error.code, error.message, error.status, error.status >= 500);
    logger.error("tesla.history_unexpected", { error });
    return jsonError("TESLA_UNEXPECTED", "No pudimos consultar el historial de carga.", 502, true);
  }
}
