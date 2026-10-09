import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import type { CompanyWorkspace } from "./company";
export async function companyWorkspace(ownerOnly = false) { await requireRole("recruiter"); const workspace = await recruiterAPI<CompanyWorkspace>("/api/v1/company/workspace"); if (ownerOnly && workspace.member.role !== "primary_admin")
    notFound(); return workspace; }
