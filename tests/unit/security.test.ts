import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { hashPassword, verifyPassword, passwordSchema, emailSchema } from "@/lib/auth/credentials";

describe("token encryption", () => {
  it("round-trips a token with AES-256-GCM", () => {
    const token = "spotify-access-token-123";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("produces a unique ciphertext each time", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptToken("sensitive");
    const parts = encrypted.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${Buffer.from("hacked").toString("base64url")}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});

describe("credentials", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("TeclaSegura2026");
    expect(hash).not.toContain("TeclaSegura2026");
    await expect(verifyPassword("TeclaSegura2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrecta", hash)).resolves.toBe(false);
  }, 20_000);

  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("corta1").success).toBe(false);
    expect(passwordSchema.safeParse("sinNumerosSuficientes").success).toBe(false);
    expect(passwordSchema.safeParse("TeclaSegura2026").success).toBe(true);
  });

  it("normalizes emails and rejects invalid ones", () => {
    expect(emailSchema.parse("  USER@Example.COM ")).toBe("user@example.com");
    expect(emailSchema.safeParse("no-es-email").success).toBe(false);
  });
});
