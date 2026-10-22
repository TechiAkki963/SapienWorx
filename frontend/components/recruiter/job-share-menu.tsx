"use client";

import { useState } from "react";
import { CareerIcon } from "../candidate/career-icon";
import { recruiterPrimary, recruiterSecondary } from "./workspace-ui";
import { JobSharePanel } from "./job-share-panel";

// One recruiter sharing entry point, reused by actions and the job workspace.
export function JobShareMenu({ jobId, title, active }: { jobId: string; title: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button data-job-share-trigger type="button" disabled={!active} aria-haspopup="dialog" aria-expanded={open} className={active ? recruiterPrimary : recruiterSecondary} onClick={() => setOpen(true)}><CareerIcon name="share"/>Share job</button>{open && <JobSharePanel jobId={jobId} title={title} onClose={() => setOpen(false)}/>}</>;
}
