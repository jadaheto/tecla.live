import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverConfig } from "@/lib/env";

function key(): Buffer {
  const raw = serverConfig.tokenEncryptionKey;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
  const buffer = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buffer.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY_INVALID");
  return buffer;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("TOKEN_PAYLOAD_INVALID");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
