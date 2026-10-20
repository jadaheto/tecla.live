type LogLevel = "info" | "warn" | "error";

const SECRET_KEYS = /(key|token|secret|password|authorization|cookie|audio|transcript)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitize(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value).slice(0, 20)) {
      output[key] = SECRET_KEYS.test(key) ? "[redacted]" : sanitize(entry, depth + 1);
    }
    return output;
  }
  if (typeof value === "string" && value.length > 300) {
    return `${value.slice(0, 300)}…`;
  }
  return value;
}

function emit(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(fields ? (sanitize(fields) as Record<string, unknown>) : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
