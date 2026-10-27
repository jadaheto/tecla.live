import { jsonError, jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { disconnectTesla, teslaStorageConfigured } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para desvincular Tesla.", 401);
  if (!teslaStorageConfigured()) return jsonError("TESLA_NOT_CONFIGURED", "Tesla no está configurado.", 503);
  try {
    await disconnectTesla(claims.userId);
    return jsonOk({ connected: false });
  } catch (error) {
    logger.warn("tesla.disconnect_failed", { error });
    return jsonError("TESLA_DISCONNECT_FAILED", "No pudimos desvincular Tesla.", 503, true);
  }
}
