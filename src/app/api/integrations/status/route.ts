import { jsonOk } from "@/lib/api-response";
import { integrationStatus, serverConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk({
    integrations: {
      youtube: integrationStatus.youtube,
      deepseek: integrationStatus.deepseek,
      deepgram: integrationStatus.deepgram,
      elevenlabs: integrationStatus.elevenlabs,
      spotify: integrationStatus.spotify,
      database: integrationStatus.database,
      auth: integrationStatus.auth,
    },
    free: {
      weather: true,
      radio: true,
      podcasts: true,
      waze: true,
      googleMaps: true,
    },
    models: {
      deepseek: integrationStatus.deepseek ? serverConfig.deepseekModel : null,
      deepgram: integrationStatus.deepgram ? serverConfig.deepgramModel : null,
      elevenlabs: integrationStatus.elevenlabs ? serverConfig.elevenLabsModelId : null,
    },
    limits: {
      maxToolSteps: serverConfig.limits.maxToolSteps,
      maxTtsChars: serverConfig.limits.maxTtsChars,
      maxAudioSeconds: serverConfig.limits.maxAudioSeconds,
      monthlyBudgetUsd: serverConfig.limits.monthlyBudgetUsd,
    },
  });
}
