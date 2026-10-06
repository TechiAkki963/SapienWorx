import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SERVER_API_URL } from "@/lib/server-api-url";

export type Role = "candidate" | "recruiter" | "master_admin";
export type SessionUser = {
  id: string;
  role: Role;
  first_name: string;
  last_name: string;
  headline: string;
  profile_image_url?: string | null;
};
export class SessionConnectionError extends Error {}

export async function getSessionUser(
  renewCandidate = false,
): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_URL}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (cause) {
    if (renewCandidate)
      throw new SessionConnectionError(
        "Your session could not be checked. Your account data is unchanged.",
      );
    throw cause;
  }
  if (!response.ok) {
    if (renewCandidate && response.status !== 401 && response.status !== 403)
      throw new SessionConnectionError(
        "The account service is temporarily unavailable. Please retry.",
      );
    if (
      renewCandidate &&
      response.status === 401 &&
      cookieStore.has(
        process.env.NEXT_PUBLIC_AUTH_CSRF_COOKIE_NAME?.trim() || "sw_csrf",
      )
    ) {
      const target =
        (await headers()).get("x-swx-candidate-path") || "/candidate";
      const url = new URL(target, "https://candidate.invalid");
      if (!url.searchParams.has("_swxrenew"))
        redirect("/session/renew?returnTo=" + encodeURIComponent(target));
    }
    return null;
  }
  return (await response.json()) as SessionUser;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await getSessionUser(role === "candidate");
  if (!session) {
    redirect(
      role === "recruiter"
        ? "/recruiter/login"
        : role === "master_admin"
          ? "/swx-command-centre"
          : "/login",
    );
  }
  if (session.role !== role) {
    redirect(
      session.role === "recruiter"
        ? "/recruiter"
        : session.role === "master_admin"
          ? "/swx-command-centre/overview"
          : "/candidate",
    );
  }
  return session;
}
