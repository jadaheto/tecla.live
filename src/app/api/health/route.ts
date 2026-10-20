import { NextResponse } from "next/server";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "connected" | "unavailable" | "not_configured" = "not_configured";

  if (isDatabaseConfigured()) {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 1500)),
      ]);
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      app: "tecla-live",
      version: process.env.npm_package_version ?? "0.1.0",
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
      environment: process.env.NODE_ENV ?? "development",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
