import { z } from "zod";
import bcrypt from "bcryptjs";
import { serverConfig } from "@/lib/env";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido.")
  .max(254);

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(128, "La contraseña es demasiado larga.")
  .regex(/[A-Za-z]/, "Incluye al menos una letra.")
  .regex(/\d/, "Incluye al menos un número.");

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().max(80).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function authAvailable(): boolean {
  return Boolean(serverConfig.authSecret && serverConfig.databaseUrl);
}

export function hashRateLimitKey(value: string): string {
  // La clave se usa solo en memoria; no se registra.
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}
