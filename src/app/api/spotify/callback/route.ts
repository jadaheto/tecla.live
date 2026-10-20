import { NextResponse, type NextRequest } from "next/server";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { serverConfig } from "@/lib/env";
import { saveSpotifyAccount, SpotifyError } from "@/lib/integrations/spotify";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string, clearState = false): NextResponse {
  const response = NextResponse.redirect(new URL(path, serverConfig.appUrl));
  if (clearState) {
    response.cookies.set("tecla_spotify_state", "", {
      httpOnly: true,
      secure: serverConfig.appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/api/spotify",
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const claims = await getActiveSessionClaims();
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("tecla_spotify_state")?.value;

  if (!claims) {
    return redirect("/settings?spotify=login_required#cuenta", true);
  }
  if (error) {
    return redirect("/music?spotify=error&reason=denied", true);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    logger.warn("spotify.callback_state_invalid", { userId: claims.userId });
    return redirect("/music?spotify=error&reason=state", true);
  }

  try {
    await saveSpotifyAccount({ userId: claims.userId, code });
    return redirect("/music?spotify=connected", true);
  } catch (caught) {
    if (caught instanceof SpotifyError) {
      logger.warn("spotify.callback_failed", { code: caught.code, status: caught.status });
      return redirect(`/music?spotify=error&reason=${encodeURIComponent(caught.code)}`, true);
    }
    logger.error("spotify.callback_unexpected", { error: caught });
    return redirect("/music?spotify=error&reason=unexpected", true);
  }
}
