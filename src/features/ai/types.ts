export interface DeepSeekToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type DeepSeekMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: DeepSeekToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export interface AiHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiToolResult {
  toolCallId: string;
  name: string;
  ok: boolean;
  content: string;
}

export interface AiToolExchange {
  assistantContent: string;
  assistantToolCalls: DeepSeekToolCall[];
  toolResults: AiToolResult[];
}

export interface AiPendingAction {
  toolCallId: string;
  name: string;
  arguments: unknown;
}

export interface AiChatRequest {
  messages: AiHistoryMessage[];
  context: {
    pathname: string;
    screen: string;
    selectedTitle?: string;
    selectedKind?: string;
    player?: {
      kind?: string;
      title?: string;
      isPlaying?: boolean;
      positionSeconds?: number;
      durationSeconds?: number;
    };
    capabilities?: {
      microphone?: boolean;
      fullscreen?: boolean;
      webSpeech?: boolean;
    };
    memory?: Array<{ key: string; value: string }>;
    persona?: "copiloto" | "jarvis" | "kitt" | "piloto" | "computadora";
    visualStyle?: "tecla" | "cyberpunk" | "kitt" | "roadster" | "discovery";
    spotifyDeviceId?: string;
    assistantName?: string;
  };
  toolExchange?: AiToolExchange;
}

export interface AiChatResponse {
  content: string;
  pendingActions: AiPendingAction[];
  toolExchange?: AiToolExchange;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason: string;
  stepLimited?: boolean;
}

export interface AiActionExecution {
  toolCallId: string;
  name: string;
  ok: boolean;
  content: string;
  summary: string;
}
