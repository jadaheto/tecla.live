import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { serverConfig } from "@/lib/env";
import {
  buildSpotifyAuthUrl,
  spotifyConfigured,
  spotifyEncryptionConfigured,
} from "@/lib/integrations/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, serverConfig.appUrl));
}

export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return redirect("/settings?spotify=login_required#cuenta");
  }
  if (!spotifyConfigured() || !spotifyEncryptionConfigured()) {
    return redirect("/music?spotify=error&reason=not_configured");
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildSpotifyAuthUrl(state));
  response.cookies.set("tecla_spotify_state", state, {
    httpOnly: true,
    secure: serverConfig.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/spotify",
    maxAge: 600,
  });
  return response;
}
