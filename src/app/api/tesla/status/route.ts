import { jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { serverConfig } from "@/lib/env";
import { TESLA_PROVIDER, teslaConfigured, teslaStorageConfigured } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  const configured = teslaConfigured() && teslaStorageConfigured();
  const base = { configured, authenticated: Boolean(claims), connected: false, domain: serverConfig.teslaDomain, region: serverConfig.teslaRegion };
  if (!claims || !configured || !isDatabaseConfigured()) return jsonOk(base);
  try {
    const account = await prisma.connectedAccount.findUnique({
      where: { userId_provider: { userId: claims.userId, provider: TESLA_PROVIDER } },
      select: { scope: true, updatedAt: true },
    });
    return jsonOk({
      ...base,
      connected: Boolean(account),
      account: account ? { scope: account.scope, updatedAt: account.updatedAt.toISOString() } : null,
    });
  } catch (error) {
    logger.warn("tesla.status_failed", { error });
    return jsonOk(base);
  }
}
