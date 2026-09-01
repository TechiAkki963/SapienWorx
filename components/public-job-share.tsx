"use client";

import { useState } from "react";

export function PublicJobShare({ publicPath, title, company }: { publicPath: string; title: string; company: string }) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = new URL(publicPath, window.location.origin);
    url.searchParams.set("source", "candidate_share");
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} at ${company}`, text: `Explore ${title} at ${company} on Sapienworx.`, url: url.toString() });
        setStatus("Job shared.");
      } else {
        await navigator.clipboard.writeText(url.toString());
        setStatus("Share link copied.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setStatus("Sharing is unavailable here. Copy the page address instead.");
    }
  }

  return <span className="public-job-share-wrap"><button className="public-job-share" type="button" onClick={() => void share()} aria-describedby={status ? `share-status-${publicPath.replace(/\W/g, "")}` : undefined}>↗ Share job</button>{status && <small id={`share-status-${publicPath.replace(/\W/g, "")}`} role="status">{status}</small>}</span>;
}
