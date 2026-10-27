import { NextResponse, type NextRequest } from "next/server";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { serverConfig } from "@/lib/env";
import { saveTeslaAccount, TeslaError } from "@/lib/integrations/tesla";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string, clearState = false): NextResponse {
  const response = NextResponse.redirect(new URL(path, serverConfig.appUrl));
  if (clearState) {
    response.cookies.set("tecla_tesla_state", "", {
      httpOnly: true,
      secure: serverConfig.appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/api/tesla",
      maxAge: 0,
    });
  }
  return response;
}

/**
 * Llega aquí reenviado desde `https://<TESLA_DOMAIN>/tesla/callback.php`
 * (el dominio registrado en Tesla), con el mismo `code` y `state`.
 */
export async function GET(request: NextRequest) {
  const claims = await getActiveSessionClaims();
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("tecla_tesla_state")?.value;

  if (!claims) return redirect("/settings?tesla=login_required#cuenta", true);
  if (error) return redirect("/settings?tesla=error&reason=denied#mi-tesla", true);
  if (!code || !state || !expectedState || state !== expectedState) {
    logger.warn("tesla.callback_state_invalid", { userId: claims.userId });
    return redirect("/settings?tesla=error&reason=state#mi-tesla", true);
  }
  try {
    await saveTeslaAccount({ userId: claims.userId, code });
    return redirect("/settings?tesla=connected#mi-tesla", true);
  } catch (caught) {
    if (caught instanceof TeslaError) {
      logger.warn("tesla.callback_failed", { code: caught.code, status: caught.status });
      return redirect(`/settings?tesla=error&reason=${encodeURIComponent(caught.code)}#mi-tesla`, true);
    }
    logger.error("tesla.callback_unexpected", { error: caught });
    return redirect("/settings?tesla=error&reason=unexpected#mi-tesla", true);
  }
}
