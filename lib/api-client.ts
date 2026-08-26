// A local API is available through docker compose by default. Production sets
// this to its HTTPS API origin at build time.
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie.split("; ").find((value) => value.startsWith("XSRF-TOKEN="))?.split("=")[1];
}

let csrfBootstrap: Promise<void> | undefined;

async function ensureCsrfToken() {
  if (csrfToken() || typeof document === "undefined") return csrfToken();
  csrfBootstrap ??= fetch(`${apiBaseUrl}/api/auth/csrf`, { credentials: "include", cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Unable to prepare the secure request.");
    })
    .finally(() => { csrfBootstrap = undefined; });
  await csrfBootstrap;
  return csrfToken();
}

export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);
  const requiresCsrf = isStateChanging && !path.startsWith("/api/auth/request-otp") && !path.startsWith("/api/auth/verify-otp");
  const token = requiresCsrf ? await ensureCsrfToken() : csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token && isStateChanging ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const rawBody = await response.text();
    let body: { detail?: string; message?: string } | null = null;
    try { body = rawBody ? JSON.parse(rawBody) as { detail?: string; message?: string } : null; } catch { /* Empty or non-JSON error response. */ }
    const fallback = response.status === 403
      ? "Your secure request could not be verified. Refresh the page and try again."
      : "The request could not be completed.";
    throw new Error(body?.detail ?? body?.message ?? fallback);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
