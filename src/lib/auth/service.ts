import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { signSessionToken, SESSION_DAYS } from "@/lib/auth/session";

export async function issueSession(input: {
  userId: string;
  email: string;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: input.userId,
      jti,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });

  const token = await signSessionToken({
    userId: input.userId,
    email: input.email,
    jti,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function revokeSession(jti: string): Promise<void> {
  await prisma.session.updateMany({
    where: { jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
