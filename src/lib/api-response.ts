import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  retryable = false,
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, retryable } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(headers ?? {}),
      },
    },
  );
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;
