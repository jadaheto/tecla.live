import { getActiveSessionClaims } from "@/lib/auth/session";
import { jsonError, jsonOk, readJson } from "@/lib/api-response";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { preferencesSyncSchema } from "@/lib/validation/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para ver tus preferencias.", 401, false);
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_NOT_CONFIGURED", "La sincronización no está configurada.", 503, false);
  }
  try {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId: claims.userId },
    });
    return jsonOk({ preferences, source: "database" });
  } catch (error) {
    logger.error("preferences.read_failed", { error });
    return jsonError("PREFERENCES_UNAVAILABLE", "No pudimos leer tus preferencias.", 502, true);
  }
}

export async function PUT(request: Request) {
  const claims = await getActiveSessionClaims();
  if (!claims) return jsonError("AUTH_REQUIRED", "Inicia sesión para guardar preferencias.", 401, false);
  if (!isDatabaseConfigured()) {
    return jsonError("DATABASE_NOT_CONFIGURED", "La sincronización no está configurada.", 503, false);
  }

  const parsed = preferencesSyncSchema.partial().safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("INVALID_PREFERENCES", "Las preferencias no son válidas.", 400);
  }

  try {
    const preferences = await prisma.userPreference.upsert({
      where: { userId: claims.userId },
      create: { userId: claims.userId, ...parsed.data },
      update: parsed.data,
    });
    return jsonOk({ preferences });
  } catch (error) {
    logger.error("preferences.write_failed", { error });
    return jsonError("PREFERENCES_UNAVAILABLE", "No pudimos guardar tus preferencias.", 502, true);
  }
}
