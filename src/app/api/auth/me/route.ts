import { jsonOk } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { authAvailable } from "@/lib/auth/credentials";
import { isDatabaseConfigured } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return jsonOk({
    user,
    accountsAvailable: authAvailable() && isDatabaseConfigured(),
  });
}
