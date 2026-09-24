import { cookies } from "next/headers";
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

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;
  const response = await fetch(`${SERVER_API_URL}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as SessionUser;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    redirect(role === "recruiter" ? "/recruiter/login" : role === "master_admin" ? "/swx-command-centre" : "/login");
  }
  if (session.role !== role) {
    redirect(session.role === "recruiter" ? "/recruiter" : session.role === "master_admin" ? "/swx-command-centre/overview" : "/candidate");
  }
  return session;
}
