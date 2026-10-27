import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { wakeTeslaVehicle, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Despierta el vehículo a petición explícita del usuario (gasta algo de batería). */
export async function POST() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para despertar tu Tesla.", 401);
  const limit = consumeRateLimit(`tesla-wake:${claims.userId}`, 3, 5 * 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Ya pediste despertar el auto hace poco. Dale unos segundos.", 429, true, rateLimitHeaders(limit));
  try {
    return jsonOk(await wakeTeslaVehicle(claims.userId));
  } catch (error) {
    if (error instanceof TeslaError) return jsonError(error.code, error.message, error.status, error.status >= 500);
    logger.error("tesla.wake_unexpected", { error });
    return jsonError("TESLA_UNEXPECTED", "No pudimos despertar tu Tesla.", 502, true);
  }
}
