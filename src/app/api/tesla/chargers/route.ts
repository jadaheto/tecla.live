import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { getTeslaNearbyChargers, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supercargadores y cargadores de destino cerca del auto (caché de 10 minutos). */
export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para ver los cargadores cercanos.", 401);
  const limit = consumeRateLimit(`tesla-chargers:${claims.userId}`, 12, 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Demasiadas consultas de cargadores.", 429, true, rateLimitHeaders(limit));
  try {
    return jsonOk(await getTeslaNearbyChargers(claims.userId));
  } catch (error) {
    if (error instanceof TeslaError) return jsonError(error.code, error.message, error.status, error.status >= 500);
    logger.error("tesla.chargers_unexpected", { error });
    return jsonError("TESLA_UNEXPECTED", "No pudimos consultar los cargadores cercanos.", 502, true);
  }
}
