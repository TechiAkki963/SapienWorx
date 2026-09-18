import { cookies } from "next/headers";

import { SERVER_API_URL } from "@/lib/server-api-url";

export class AdminBackendError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function parseMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export async function adminAPI<T>(path: string): Promise<T> {
  const store = await cookies();
  const response = await fetch(`${SERVER_API_URL}${path}`, {
    headers: { cookie: store.toString() },
    cache: "no-store",
  });
  if (!response.ok) throw new AdminBackendError(await parseMessage(response), response.status);
  return (await response.json()) as T;
}
