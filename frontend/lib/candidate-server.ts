import { cookies } from "next/headers";

import { API_URL } from "@/lib/api";

export class BackendResponseError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export async function publicAPI<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new BackendResponseError(await parseError(response), response.status);
  return (await response.json()) as T;
}

export async function candidateAPI<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (!response.ok) throw new BackendResponseError(await parseError(response), response.status);
  return (await response.json()) as T;
}
