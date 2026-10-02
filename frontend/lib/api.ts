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

const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_AUTH_CSRF_COOKIE_NAME?.trim() || "sw_csrf";

function csrfToken() {
  if (typeof document === "undefined") return "";
  const prefix = `${CSRF_COOKIE_NAME}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function authHeaders(init: RequestInit) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers = new Headers(init.headers ?? {});
  if (!isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

const refreshExcluded = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/candidate/register",
  "/api/v1/auth/recruiter/register",
  "/api/v1/auth/email/request",
  "/api/v1/auth/email/verify",
  "/api/v1/auth/password/forgot",
  "/api/v1/auth/password/reset",
  "/api/v1/auth/refresh",
]);

async function rawRequest(path: string, init: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: authHeaders(init),
  });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await rawRequest(path, init);
  if (response.status === 401 && !refreshExcluded.has(path)) {
    const refreshed = await rawRequest("/api/v1/auth/refresh", { method: "POST" });
    if (refreshed.ok) response = await rawRequest(path, init);
  }
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
