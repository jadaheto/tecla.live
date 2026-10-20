import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export function internalError(event: string, error: unknown): NextResponse {
  logger.error(event, { error });
  return jsonError(
    "INTERNAL_ERROR",
    "Ocurrió un error inesperado. Intenta de nuevo.",
    500,
    true,
  );
}
