import { createHash } from "node:crypto";
import { serverConfig } from "@/lib/env";
import { isDatabaseConfigured, prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type AiProvider = "deepseek" | "deepgram" | "elevenlabs";

/**
 * Tarifas de referencia usadas solo para estimar consumo.
 * Deben revisarse contra la página de precios vigente de cada proveedor.
 */
export const REFERENCE_PRICING = {
  deepseekInputPerMillionTokens: 0.28,
  deepseekOutputPerMillionTokens: 1.1,
  deepgramPerAudioMinute: 0.0077,
  elevenLabsPerThousandCharacters: 0.05,
} as const;

interface UsageMemory {
  monthKey: string;
  estimatedUsd: number;
  dbCache: { value: number; readAt: number } | null;
}

const globalUsage = globalThis as unknown as { __teclaAiUsage?: UsageMemory };

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function memory(): UsageMemory {
  const key = monthKey();
  if (!globalUsage.__teclaAiUsage || globalUsage.__teclaAiUsage.monthKey !== key) {
    globalUsage.__teclaAiUsage = { monthKey: key, estimatedUsd: 0, dbCache: null };
  }
  return globalUsage.__teclaAiUsage;
}

export function usageSessionId(input: { ip: string; userId?: string | null }): string {
  if (input.userId) return `user:${input.userId}`;
  const hash = createHash("sha256").update(`tecla:${input.ip}`).digest("hex").slice(0, 18);
  return `guest:${hash}`;
}

export function estimateCost(input: {
  provider: AiProvider;
  inputUnits: number;
  outputUnits: number;
}): number {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  switch (input.provider) {
    case "deepseek":
      return (
        (safe(input.inputUnits) / 1_000_000) * REFERENCE_PRICING.deepseekInputPerMillionTokens +
        (safe(input.outputUnits) / 1_000_000) * REFERENCE_PRICING.deepseekOutputPerMillionTokens
      );
    case "deepgram":
      return (safe(input.inputUnits) / 60) * REFERENCE_PRICING.deepgramPerAudioMinute;
    case "elevenlabs":
      return (safe(input.inputUnits) / 1000) * REFERENCE_PRICING.elevenLabsPerThousandCharacters;
    default:
      return 0;
  }
}

async function readDatabaseSpend(): Promise<number> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  try {
    const aggregate = await prisma.aIUsageEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: start } },
    });
    return aggregate._sum.estimatedCostUsd?.toNumber() ?? 0;
  } catch (error) {
    logger.warn("ai_usage.db_read_failed", { error });
    return 0;
  }
}

export async function getMonthlySpendUsd(): Promise<number> {
  const state = memory();
  if (!isDatabaseConfigured()) return state.estimatedUsd;
  if (state.dbCache && Date.now() - state.dbCache.readAt < 30_000) {
    return state.dbCache.value;
  }
  const value = await readDatabaseSpend();
  state.dbCache = { value, readAt: Date.now() };
  return value;
}

export interface BudgetCheck {
  allowed: boolean;
  spendUsd: number;
  budgetUsd: number;
}

export async function checkAiBudget(): Promise<BudgetCheck> {
  const spendUsd = await getMonthlySpendUsd();
  const budgetUsd = serverConfig.limits.monthlyBudgetUsd;
  return { allowed: budgetUsd <= 0 ? spendUsd <= 0 : spendUsd < budgetUsd, spendUsd, budgetUsd };
}

export async function recordProviderUsage(input: {
  userId?: string | null;
  sessionId: string;
  provider: AiProvider;
  operation: string;
  inputUnits: number;
  outputUnits: number;
}): Promise<number> {
  const cost = estimateCost(input);
  const state = memory();
  state.estimatedUsd += cost;
  if (state.dbCache) state.dbCache.value += cost;

  if (isDatabaseConfigured()) {
    try {
      await prisma.aIUsageEvent.create({
        data: {
          userId: input.userId ?? null,
          sessionId: input.sessionId,
          provider: input.provider,
          operation: input.operation,
          inputUnits: Math.max(0, Math.round(input.inputUnits)),
          outputUnits: Math.max(0, Math.round(input.outputUnits)),
          estimatedCostUsd: cost,
        },
      });
    } catch (error) {
      logger.warn("ai_usage.db_write_failed", { provider: input.provider, error });
    }
  }

  return cost;
}
