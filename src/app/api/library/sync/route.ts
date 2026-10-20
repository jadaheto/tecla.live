import { getClientIp, jsonError, jsonOk, readJson } from "@/lib/api-response";
import { getActiveSessionClaims } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { librarySyncSchema } from "@/lib/validation/library";
import type { HistoryEntry, SavedFavorite } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const claims = await getActiveSessionClaims();
  if (!claims) {
    return jsonError("AUTH_REQUIRED", "Inicia sesión para sincronizar tu biblioteca.", 401, false);
  }
  if (!isDatabaseConfigured()) {
    return jsonError(
      "DATABASE_NOT_CONFIGURED",
      "La sincronización todavía no está configurada. Tus datos locales siguen disponibles.",
      503,
      false,
    );
  }

  const ip = getClientIp(request);
  const limit = consumeRateLimit(`library-sync:${claims.userId}:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Espera un momento antes de volver a sincronizar.", 429, true);
  }

  const parsed = librarySyncSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(
      "INVALID_LIBRARY",
      parsed.error.issues[0]?.message ?? "Los datos de la biblioteca no son válidos.",
      400,
    );
  }

  try {
    const userId = claims.userId;

    for (const favorite of parsed.data.favorites) {
      await prisma.favorite.upsert({
        where: {
          userId_kind_providerId: {
            userId,
            kind: favorite.kind,
            providerId: favorite.providerId,
          },
        },
        create: {
          userId,
          kind: favorite.kind,
          providerId: favorite.providerId,
          title: favorite.title,
          subtitle: favorite.subtitle,
          imageUrl: favorite.imageUrl,
          href: favorite.href,
        },
        update: {
          title: favorite.title,
          subtitle: favorite.subtitle,
          imageUrl: favorite.imageUrl,
          href: favorite.href,
        },
      });
    }

    for (const entry of parsed.data.history) {
      await prisma.watchHistory.upsert({
        where: {
          userId_kind_providerId: {
            userId,
            kind: entry.kind,
            providerId: entry.providerId,
          },
        },
        create: {
          userId,
          kind: entry.kind,
          providerId: entry.providerId,
          title: entry.title,
          subtitle: entry.subtitle,
          imageUrl: entry.imageUrl,
          href: entry.href,
          positionSeconds: entry.positionSeconds,
          durationSeconds: entry.durationSeconds,
          lastWatchedAt: entry.lastWatchedAt ? new Date(entry.lastWatchedAt) : new Date(),
        },
        update: {
          title: entry.title,
          subtitle: entry.subtitle,
          imageUrl: entry.imageUrl,
          href: entry.href,
          positionSeconds: entry.positionSeconds,
          durationSeconds: entry.durationSeconds,
          lastWatchedAt: entry.lastWatchedAt ? new Date(entry.lastWatchedAt) : new Date(),
        },
      });
    }

    if (parsed.data.preferences) {
      const preferences = parsed.data.preferences;
      await prisma.userPreference.upsert({
        where: { userId },
        create: { userId, ...preferences },
        update: preferences,
      });
    }

    const [favorites, history] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.watchHistory.findMany({
        where: { userId },
        orderBy: { lastWatchedAt: "desc" },
        take: 100,
      }),
    ]);

    const savedFavorites: SavedFavorite[] = favorites.map((favorite) => ({
      kind: favorite.kind as SavedFavorite["kind"],
      providerId: favorite.providerId,
      title: favorite.title,
      subtitle: favorite.subtitle ?? undefined,
      imageUrl: favorite.imageUrl ?? undefined,
      href: favorite.href ?? undefined,
      addedAt: favorite.createdAt.toISOString(),
    }));

    const savedHistory: HistoryEntry[] = history.map((entry) => ({
      kind: entry.kind as HistoryEntry["kind"],
      providerId: entry.providerId,
      title: entry.title,
      subtitle: entry.subtitle ?? undefined,
      imageUrl: entry.imageUrl ?? undefined,
      href: entry.href ?? undefined,
      positionSeconds: entry.positionSeconds,
      durationSeconds: entry.durationSeconds,
      lastWatchedAt: entry.lastWatchedAt.toISOString(),
    }));

    logger.info("library.synced", {
      userId,
      favorites: savedFavorites.length,
      history: savedHistory.length,
    });

    return jsonOk({
      favorites: savedFavorites,
      history: savedHistory,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("library.sync_failed", { error });
    return jsonError("SYNC_FAILED", "No pudimos sincronizar tu biblioteca. Intenta de nuevo.", 502, true);
  }
}
