import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { serverConfig } from "@/lib/env";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE = "tecla_session";
export const SESSION_DAYS = 30;
const ISSUER = "tecla.live";
const AUDIENCE = "tecla-live";

export interface SessionClaims {
  userId: string;
  email: string;
  jti: string;
}

export function sessionsConfigured(): boolean {
  return Boolean(serverConfig.authSecret);
}

function secretKey(): Uint8Array {
  if (!serverConfig.authSecret) throw new Error("AUTH_NOT_CONFIGURED");
  return new TextEncoder().encode(serverConfig.authSecret);
}

export async function signSessionToken(input: {
  userId: string;
  email: string;
  jti: string;
  expiresAt: Date;
}): Promise<string> {
  return new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setJti(input.jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.email !== "string" || !payload.jti) return null;
    return { userId: payload.sub, email: payload.email, jti: payload.jti };
  } catch {
    return null;
  }
}

export async function getSessionClaims(): Promise<SessionClaims | null> {
  if (!sessionsConfigured()) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Verifica la firma y además que la sesión siga activa en PostgreSQL.
 * Se usa en rutas con datos de usuario para que el logout revoque de inmediato.
 */
export async function getActiveSessionClaims(): Promise<SessionClaims | null> {
  const claims = await getSessionClaims();
  if (!claims) return null;
  if (!isDatabaseConfigured()) return null;
  try {
    const session = await prisma.session.findUnique({ where: { jti: claims.jti } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
    if (session.userId !== claims.userId) return null;
    return claims;
  } catch (error) {
    logger.warn("auth.session_check_failed", { error });
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: serverConfig.appUrl.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
