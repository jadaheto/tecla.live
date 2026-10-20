import { jsonOk } from "@/lib/api-response";
import { revokeSession } from "@/lib/auth/service";
import { getSessionClaims, sessionCookieOptions } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const claims = await getSessionClaims();
  if (claims) {
    try {
      await revokeSession(claims.jti);
    } catch (error) {
      logger.warn("auth.logout_revoke_failed", { error });
    }
  }

  const response = jsonOk({ ok: true });
  response.cookies.set({
    ...sessionCookieOptions(),
    value: "",
    maxAge: 0,
  });
  return response;
}
