import { cookies } from "next/headers";

import { API_URL } from "@/lib/api";

export class MessagingBackendError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function parseMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "Messaging request failed.";
  } catch {
    return "Messaging request failed.";
  }
}

export async function messagingAPI<T>(path: string): Promise<T> {
  const store = await cookies();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { cookie: store.toString() },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new MessagingBackendError(await parseMessage(response), response.status);
  }

  return (await response.json()) as T;
}
