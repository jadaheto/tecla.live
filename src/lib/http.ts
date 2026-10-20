export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(input: { status: number; code: string; message: string; retryable?: boolean }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.retryable = input.retryable ?? false;
  }
}

interface ErrorPayload {
  error?: { code?: string; message?: string; retryable?: boolean };
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: ErrorPayload | null = null;
    try {
      payload = (await response.json()) as ErrorPayload;
    } catch {
      // respuesta no JSON
    }
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? "REQUEST_FAILED",
      message:
        payload?.error?.message ??
        (response.status === 429
          ? "Demasiadas solicitudes. Espera un momento."
          : "No pudimos completar la solicitud."),
      retryable: payload?.error?.retryable ?? response.status >= 500,
    });
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
