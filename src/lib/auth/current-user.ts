import { getActiveSessionClaims } from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const claims = await getActiveSessionClaims();
  if (!claims) return null;
  if (!isDatabaseConfigured()) {
    return { id: claims.userId, email: claims.email, name: null };
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, email: true, name: true },
    });
    return user ?? null;
  } catch {
    return { id: claims.userId, email: claims.email, name: null };
  }
}
