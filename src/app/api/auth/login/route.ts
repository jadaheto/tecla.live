import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import {
  authAvailable,
  hashRateLimitKey,
  loginSchema,
  verifyPassword,
} from "@/lib/auth/credentials";
import { issueSession } from "@/lib/auth/service";
import { sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authAvailable()) {
    return jsonError(
      "AUTH_NOT_CONFIGURED",
      "Las cuentas todavía no están configuradas. Puedes usar TECLA LIVE como invitado.",
      503,
      false,
    );
  }

  const ip = getClientIp(request);
  const ipLimit = consumeRateLimit(`login:${ip}`, 10, 60_000);
  if (!ipLimit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiados intentos. Espera un momento antes de volver a intentar.",
      429,
      true,
      { "Retry-After": String(ipLimit.retryAfterSeconds) },
    );
  }

  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
  }

  const emailLimit = consumeRateLimit(
    `login-email:${hashRateLimitKey(parsed.data.email)}`,
    8,
    5 * 60_000,
  );
  if (!emailLimit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiados intentos para esta cuenta. Espera unos minutos.",
      429,
      true,
      { "Retry-After": String(emailLimit.retryAfterSeconds) },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user || !valid) {
      return jsonError("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
    }

    const session = await issueSession({
      userId: user.id,
      email: user.email,
      userAgent: request.headers.get("user-agent"),
    });

    const response = jsonOk({ user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set({ ...sessionCookieOptions(), value: session.token });
    logger.info("auth.login_success", { userId: user.id });
    return response;
  } catch (error) {
    logger.error("auth.login_failed", { error });
    return jsonError("AUTH_ERROR", "No pudimos iniciar sesión. Intenta de nuevo.", 500, true);
  }
}
