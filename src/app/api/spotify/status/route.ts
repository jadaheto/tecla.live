import { jsonOk } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  spotifyConfigured,
  spotifyEncryptionConfigured,
} from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  const configured = spotifyConfigured() && spotifyEncryptionConfigured();

  if (!claims || !configured || !isDatabaseConfigured()) {
    return jsonOk({
      configured,
      authenticated: Boolean(claims),
      connected: false,
      encrypted: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
    });
  }

  try {
    const account = await prisma.connectedAccount.findUnique({
      where: { userId_provider: { userId: claims.userId, provider: "spotify" } },
      select: { providerAccountId: true, scope: true, updatedAt: true },
    });
    return jsonOk({
      configured,
      authenticated: true,
      connected: Boolean(account),
      account: account
        ? {
            providerAccountId: account.providerAccountId,
            scope: account.scope,
            updatedAt: account.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    logger.warn("spotify.status_failed", { error });
    return jsonOk({ configured, authenticated: true, connected: false });
  }
}
