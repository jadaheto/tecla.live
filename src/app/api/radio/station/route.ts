import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { fetchRadioStationById, RadioError } from "@/lib/integrations/radio";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ id: z.string().trim().min(10).max(60) });

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`radio-station:${ip}`, 40, 60_000);
  if (!limit.ok) {
    return jsonError("RATE_LIMITED", "Demasiadas solicitudes. Espera un momento.", 429, true);
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ id: url.searchParams.get("id") ?? "" });
  if (!parsed.success) {
    return jsonError("INVALID_STATION_ID", "El identificador de la emisora no es válido.", 400);
  }

  try {
    const station = await fetchRadioStationById(parsed.data.id);
    if (!station) {
      return jsonError("STATION_NOT_FOUND", "Esa emisora no está disponible ahora.", 404);
    }
    return jsonOk({ station });
  } catch (error) {
    if (error instanceof RadioError) {
      return jsonError(error.code, error.message, error.status, true);
    }
    logger.warn("radio.station_failed", { error });
    return jsonError("RADIO_ERROR", "No pudimos cargar la emisora.", 502, true);
  }
}
