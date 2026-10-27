import { jsonOk } from "@/lib/api-response";
import { serverConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clave del Maps Embed API para el navegador. Es pública por diseño (viaja
 * en la URL del iframe); la protección real es la restricción por referente
 * y por API configurada en Google Cloud, documentada en docs/NAVIGATION.md.
 */
export async function GET() {
  return jsonOk({ configured: Boolean(serverConfig.googleMapsEmbedKey), key: serverConfig.googleMapsEmbedKey || null });
}
