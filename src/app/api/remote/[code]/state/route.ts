import { jsonError, jsonOk, readJson } from "@/lib/api-response";
import { authorizeRoom, updateState } from "@/lib/remote/rooms";
import { REMOTE_CODE, REMOTE_TOKEN, RemoteStateSchema } from "@/lib/remote/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El auto publica qué pantalla y qué audio tiene, para mostrarlo en el celular. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const token = request.headers.get("x-remote-token") ?? "";
  if (!REMOTE_CODE.test(upper) || !REMOTE_TOKEN.test(token)) return jsonError("INVALID_CODE", "Código inválido.", 400);
  const room = authorizeRoom(upper, token);
  if (!room) return jsonError("REMOTE_NOT_FOUND", "Sala no encontrada o caducada.", 404);
  const parsed = RemoteStateSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("INVALID_STATE", "Estado inválido.", 400);
  updateState(room, parsed.data);
  return jsonOk({ ok: true });
}
