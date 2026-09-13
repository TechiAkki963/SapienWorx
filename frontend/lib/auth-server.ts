import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_URL } from "@/lib/api";

export type Role = "candidate" | "recruiter" | "master_admin";
export type SessionUser = { id: string; role: Role };

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as SessionUser;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect(role === "recruiter" ? "/recruiter/login" : role === "master_admin" ? "/_admin/login" : "/login");
  if (session.role !== role) redirect(session.role === "recruiter" ? "/recruiter" : session.role === "master_admin" ? "/_admin" : "/candidate");
  return session;
}
