import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { serverConfig } from "@/lib/env";
import { buildTeslaAuthUrl, teslaConfigured, teslaStorageConfigured } from "@/lib/integrations/tesla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, serverConfig.appUrl));
}

/** Inicia la vinculación con la cuenta Tesla del usuario (requiere sesión en TECLA). */
export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) return redirect("/settings?tesla=login_required#cuenta");
  if (!teslaConfigured() || !teslaStorageConfigured()) return redirect("/settings?tesla=error&reason=not_configured#mi-tesla");

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildTeslaAuthUrl(state));
  response.cookies.set("tecla_tesla_state", state, {
    httpOnly: true,
    secure: serverConfig.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/tesla",
    maxAge: 600,
  });
  return response;
}
