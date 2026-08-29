// A local API is available through docker compose by default. Production sets
// this to its HTTPS API origin at build time.
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

type CsrfBootstrapResponse = { token?: string };
let csrfBootstrap: Promise<string | undefined> | undefined;

async function ensureCsrfToken() {
  if (typeof document === "undefined") return undefined;
  // The API rotates the cookie-backed CSRF token after a successful write.
  // Fetch a fresh token for every state-changing request while still sharing
  // one in-flight bootstrap when two controls are submitted together.
  if (!csrfBootstrap) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    csrfBootstrap = fetch(`${apiBaseUrl}/api/auth/csrf`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to prepare the secure request.");
        const body = await response.json() as CsrfBootstrapResponse;
        if (!body.token) throw new Error("Unable to prepare the secure request.");
        return body.token;
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("The secure request took too long. Please try again.");
        }
        throw error;
      })
      .finally(() => {
        clearTimeout(timeout);
        csrfBootstrap = undefined;
      });
  }
  return csrfBootstrap;
}

export async function apiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);
  const requiresCsrf = isStateChanging && !path.startsWith("/api/auth/request-otp") && !path.startsWith("/api/auth/verify-otp");
  const token = requiresCsrf ? await ensureCsrfToken() : undefined;
  const requestController = new AbortController();
  const externalSignal = init.signal;
  const forwardAbort = () => requestController.abort(externalSignal?.reason);
  let timedOut = false;
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, isFormData ? 60_000 : 20_000);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: requestController.signal,
      credentials: "include",
      headers: {
        ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token && isStateChanging ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (timedOut) throw new Error("This is taking longer than expected. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
  if (!response.ok) {
    const rawBody = await response.text();
    let body: { detail?: string; message?: string } | null = null;
    try { body = rawBody ? JSON.parse(rawBody) as { detail?: string; message?: string } : null; } catch { /* Empty or non-JSON error response. */ }
    const fallback = response.status === 401
      ? "Sign in to continue."
      : response.status === 403 && !isStateChanging
        ? "This page is available only to your signed-in account."
        : response.status === 403
          ? "Your secure request could not be verified. Refresh the page and try again."
          : "The request could not be completed.";
    throw new Error(body?.detail ?? body?.message ?? fallback);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
