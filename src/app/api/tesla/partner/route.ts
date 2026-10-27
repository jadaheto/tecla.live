import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { registerTeslaPartner, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registro de socio ante Tesla (una vez). Solo para usuarios con sesión y
 * con el dominio ya sirviendo la llave pública; Tesla responde el detalle.
 */
export async function POST() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para registrar la app ante Tesla.", 401);
  const limit = consumeRateLimit(`tesla-partner:${claims.userId}`, 3, 10 * 60_000);
  if (!limit.ok) return jsonError("RATE_LIMITED", "Espera unos minutos antes de reintentar el registro.", 429, true);
  try {
    const result = await registerTeslaPartner();
    logger.info("tesla.partner_register", { userId: claims.userId, status: result.status, ok: result.ok });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof TeslaError) return jsonError(error.code, error.message, error.status);
    logger.error("tesla.partner_unexpected", { error });
    return jsonError("TESLA_UNEXPECTED", "No pudimos registrar la app ante Tesla.", 502, true);
  }
}
