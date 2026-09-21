const configuredPublicAPI = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_URL =
  configuredPublicAPI || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080");

export type APIError = { error?: { code?: string; message?: string; request_id?: string } };

export class APIRequestError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "APIRequestError";
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    let message = "Request could not be completed.";
    let code = "unknown_error";
    try {
      const body = (await response.json()) as APIError;
      message = body.error?.message ?? message;
      code = body.error?.code ?? code;
    } catch {}
    throw new APIRequestError(message, code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
