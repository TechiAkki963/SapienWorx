// A local API is available through docker compose by default. Production sets
// this to its HTTPS API origin at build time.
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

function csrfToken() {
  if (typeof document === "undefined") return undefined;
  return document.cookie.split("; ").find((value) => value.startsWith("XSRF-TOKEN="))?.split("=")[1];
}

export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token && !["GET", "HEAD"].includes(init.method ?? "GET") ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(body?.detail ?? body?.message ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
