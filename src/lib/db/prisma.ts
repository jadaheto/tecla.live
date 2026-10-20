import { PrismaClient } from "@prisma/client";
import { serverConfig } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { __teclaPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__teclaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: serverConfig.databaseUrl
      ? { db: { url: serverConfig.databaseUrl } }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__teclaPrisma = prisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(serverConfig.databaseUrl);
}

export async function withDatabase<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }
  return operation(prisma);
}
