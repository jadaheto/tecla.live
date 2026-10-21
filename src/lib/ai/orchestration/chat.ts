import {
  createDeepSeekCompletion,
  type DeepSeekToolDefinition,
} from "@/lib/ai/deepseek/client";
import { buildSystemPrompt } from "@/lib/ai/prompts/system";
import { buildDeepSeekTools, CLIENT_TOOL_NAMES, isToolName, TOOL_BY_NAME } from "@/lib/ai/tools/registry";
import { executeServerTool } from "@/lib/ai/tools/execute-server-tool";
import { checkAiBudget, recordProviderUsage } from "@/lib/ai/usage/ledger";
import { serverConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  AiChatRequest,
  AiChatResponse,
  AiPendingAction,
  AiToolExchange,
  AiToolResult,
  DeepSeekMessage,
  DeepSeekToolCall,
} from "@/features/ai/types";

export class AiBudgetExceededError extends Error {
  constructor() {
    super("Se alcanzó el presupuesto mensual de TECLA AI.");
    this.name = "AiBudgetExceededError";
  }
}

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOOL_RESULT_CHARS = 8000;

function clampText(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max);
}

function sanitizeToolCalls(calls: DeepSeekToolCall[]): DeepSeekToolCall[] {
  return calls.slice(0, 8).map((call) => ({
    id: clampText(call.id, 80),
    type: "function" as const,
    function: {
      name: clampText(call.function.name, 60),
      arguments: clampText(call.function.arguments, 4000),
    },
  }));
}

function buildExchangeMessages(exchange: AiToolExchange): DeepSeekMessage[] {
  const calls = sanitizeToolCalls(exchange.assistantToolCalls);
  const results = new Map<string, AiToolResult>();
  for (const result of exchange.toolResults.slice(0, 12)) {
    results.set(result.toolCallId, result);
  }

  const messages: DeepSeekMessage[] = [
    {
      role: "assistant",
      content: clampText(exchange.assistantContent, MAX_MESSAGE_CHARS),
      tool_calls: calls,
    },
  ];

  for (const call of calls) {
    const result = results.get(call.id);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: result
        ? clampText(result.content, MAX_TOOL_RESULT_CHARS)
        : JSON.stringify({
            ok: false,
            error: {
              code: "MISSING_TOOL_RESULT",
              message: "No se recibió el resultado de esta herramienta.",
            },
          }),
    });
  }

  return messages;
}

function estimatePromptTokens(messages: DeepSeekMessage[]): number {
  return Math.ceil(messages.reduce((total, message) => total + message.content.length, 0) / 4);
}

function failureResult(
  toolCallId: string,
  name: string,
  code: string,
  message: string,
): AiToolResult {
  return {
    toolCallId,
    name,
    ok: false,
    content: JSON.stringify({ ok: false, error: { code, message } }),
  };
}

export async function runAiChat(input: {
  request: AiChatRequest;
  userId: string | null;
  userName?: string | null;
  sessionId: string;
  tools?: DeepSeekToolDefinition[];
  /** Texto parcial de la respuesta final, para streaming al cliente. */
  onTextDelta?: (text: string) => void;
}): Promise<AiChatResponse> {
  const budget = await checkAiBudget();
  if (!budget.allowed) throw new AiBudgetExceededError();

  const tools = input.tools ?? buildDeepSeekTools();
  const history = input.request.messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: clampText(message.content, MAX_MESSAGE_CHARS),
  }));

  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.request, { userName: input.userName }),
    },
    ...history,
  ];

  if (input.request.toolExchange) {
    messages.push(...buildExchangeMessages(input.request.toolExchange));
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const maxSteps = serverConfig.limits.maxToolSteps;

  for (let step = 0; step < maxSteps; step += 1) {
    const completion = await createDeepSeekCompletion({
      messages,
      tools,
      maxOutputTokens: serverConfig.limits.maxOutputTokens,
      ...(input.onTextDelta ? { onTextDelta: input.onTextDelta } : {}),
    });

    const inputTokens = completion.usage.promptTokens || estimatePromptTokens(messages);
    const outputTokens = completion.usage.completionTokens || Math.ceil(completion.message.content.length / 4);
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    await recordProviderUsage({
      userId: input.userId,
      sessionId: input.sessionId,
      provider: "deepseek",
      operation: "chat_completion",
      inputUnits: inputTokens,
      outputUnits: outputTokens,
    });

    const rawCalls = sanitizeToolCalls(completion.message.toolCalls);
    const content = completion.message.content;

    if (rawCalls.length === 0) {
      return {
        content: content || "Listo.",
        pendingActions: [],
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finishReason: completion.finishReason,
      };
    }

    const assistantMessage: DeepSeekMessage = {
      role: "assistant",
      content,
      tool_calls: rawCalls,
    };
    messages.push(assistantMessage);

    const serverResults: AiToolResult[] = [];
    const pendingActions: AiPendingAction[] = [];

    for (const call of rawCalls) {
      const name = call.function.name;
      const toolCallId = call.id;

      if (!isToolName(name)) {
        serverResults.push(
          failureResult(
            toolCallId,
            name,
            "UNKNOWN_TOOL",
            "Esa herramienta no existe. Usa solo las herramientas declaradas.",
          ),
        );
        continue;
      }

      const definition = TOOL_BY_NAME.get(name);
      if (!definition) {
        serverResults.push(
          failureResult(toolCallId, name, "UNKNOWN_TOOL", "Herramienta no registrada."),
        );
        continue;
      }

      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(call.function.arguments || "{}");
      } catch {
        serverResults.push(
          failureResult(
            toolCallId,
            name,
            "INVALID_JSON",
            "Los argumentos no son JSON válido. Corrige y vuelve a intentar.",
          ),
        );
        continue;
      }

      const validated = definition.schema.safeParse(parsedArgs);
      if (!validated.success) {
        serverResults.push(
          failureResult(
            toolCallId,
            name,
            "INVALID_ARGUMENTS",
            `Argumentos inválidos: ${validated.error.issues
              .slice(0, 3)
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")}`,
          ),
        );
        continue;
      }

      if (CLIENT_TOOL_NAMES.has(name)) {
        pendingActions.push({
          toolCallId,
          name,
          arguments: validated.data,
        });
        continue;
      }

      const execution = await executeServerTool(name, validated.data, {
        userId: input.userId,
        sessionId: input.sessionId,
        spotifyDeviceId: input.request.context.spotifyDeviceId ?? null,
      });
      serverResults.push({
        toolCallId,
        name,
        ok: execution.ok,
        content: execution.content,
      });
    }

    if (pendingActions.length > 0) {
      logger.info("ai.client_actions_pending", {
        count: pendingActions.length,
        tools: pendingActions.map((action) => action.name),
      });
      return {
        content: content || "",
        pendingActions,
        toolExchange: {
          assistantContent: content,
          assistantToolCalls: rawCalls,
          toolResults: serverResults,
        },
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finishReason: completion.finishReason,
      };
    }

    for (const result of serverResults) {
      messages.push({
        role: "tool",
        tool_call_id: result.toolCallId,
        content: clampText(result.content, MAX_TOOL_RESULT_CHARS),
      });
    }

    if (step === maxSteps - 1) {
      return {
        content:
          content ||
          "Completé varias acciones, pero alcancé el límite de pasos de esta solicitud. ¿Quieres que continúe?",
        pendingActions: [],
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        finishReason: completion.finishReason,
        stepLimited: true,
      };
    }
  }

  return {
    content: "No pude completar la solicitud. Intenta reformularla.",
    pendingActions: [],
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    finishReason: "step_limit",
    stepLimited: true,
  };
}
