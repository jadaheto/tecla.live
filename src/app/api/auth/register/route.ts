import { Prisma } from "@prisma/client";
import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { authAvailable, registerSchema, hashPassword } from "@/lib/auth/credentials";
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
  const limit = consumeRateLimit(`register:${ip}`, 8, 60 * 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiados intentos de registro. Intenta más tarde.",
      429,
      true,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Revisa los datos de la cuenta.",
      400,
    );
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name?.trim() || null,
        passwordHash,
        preferences: {
          create: {
            weatherLocation: "Sincelejo, Sucre, Colombia",
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    const session = await issueSession({
      userId: user.id,
      email: user.email,
      userAgent: request.headers.get("user-agent"),
    });

    const response = jsonOk({ user });
    response.cookies.set({ ...sessionCookieOptions(), value: session.token });
    logger.info("auth.register_success", { userId: user.id });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(
        "ACCOUNT_EXISTS",
        "No pudimos crear la cuenta con esos datos. Prueba iniciar sesión.",
        409,
        false,
      );
    }
    logger.error("auth.register_failed", { error });
    return jsonError("AUTH_ERROR", "No pudimos crear la cuenta. Intenta de nuevo.", 500, true);
  }
}
