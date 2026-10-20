import { z } from "zod";
import { getClientIp, jsonError, jsonOk } from "@/lib/api-response";
import { fetchRadioStations, RadioError } from "@/lib/integrations/radio";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(24),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("CO"),
});

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = consumeRateLimit(`radio:${ip}`, 40, 60_000);
  if (!limit.ok) {
    return jsonError(
      "RATE_LIMITED",
      "Demasiadas búsquedas de radio. Espera un momento.",
      429,
      true,
      rateLimitHeaders(limit),
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("INVALID_QUERY", "Los parámetros de radio no son válidos.", 400);
  }

  try {
    const stations = await fetchRadioStations({
      query: parsed.data.q,
      limit: parsed.data.limit,
      countryCode: parsed.data.country,
    });
    return jsonOk({ stations, query: parsed.data.q ?? "", country: parsed.data.country });
  } catch (error) {
    if (error instanceof RadioError) {
      logger.warn("radio.fetch_failed", { code: error.code, status: error.status });
      return jsonError(error.code, error.message, error.status, true);
    }
    logger.error("radio.unexpected", { error });
    return jsonError("RADIO_ERROR", "No pudimos cargar las emisoras.", 502, true);
  }
}
