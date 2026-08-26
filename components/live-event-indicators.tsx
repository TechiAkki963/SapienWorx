"use client";

import type { CSSProperties } from "react";
import type { Workspace } from "./ui";
import { useLiveEventsStore } from "../stores/live-events";

const eventBadgeStyle: CSSProperties = {
  position: "absolute",
  top: "-5px",
  right: "-7px",
  display: "inline-grid",
  minWidth: "16px",
  height: "16px",
  placeItems: "center",
  borderRadius: "999px",
  background: "#d64762",
  color: "#fff",
  fontSize: "9px",
  fontWeight: 700,
  lineHeight: 1,
  boxShadow: "0 0 0 2px #fff",
};

const navBadgeStyle: CSSProperties = {
  marginLeft: "auto",
  display: "inline-grid",
  minWidth: "18px",
  height: "18px",
  placeItems: "center",
  borderRadius: "999px",
  background: "#e5f5f2",
  color: "#0f766e",
  fontSize: "10px",
  fontWeight: 700,
  lineHeight: 1,
};

const noticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  width: "fit-content",
  maxWidth: "100%",
  margin: "0 0 16px",
  padding: "8px 12px",
  border: "1px solid #bfe4df",
  borderRadius: "8px",
  background: "#f1fbf9",
  color: "#0f5f59",
  fontSize: "12px",
  lineHeight: 1.35,
};

export function LiveEventIndicator({ workspace }: { workspace: Workspace }) {
  const notifications = useLiveEventsStore((state) => state.unreadNotificationCount);
  const pipelineUpdates = useLiveEventsStore((state) => state.pipelineUpdates.length);
  const count = workspace === "recruiter" ? notifications + pipelineUpdates : notifications;
  if (count === 0) return null;
  return <span style={eventBadgeStyle} aria-label={`${count} live updates`}>{count > 9 ? "9+" : count}</span>;
}

export function LivePipelineBadge() {
  const count = useLiveEventsStore((state) => state.pipelineUpdates.length);
  if (count === 0) return null;
  return <span style={navBadgeStyle} aria-label={`${count} recent pipeline updates`}>{count > 9 ? "9+" : count}</span>;
}

export function LiveUpdateNotice({ workspace }: { workspace: Workspace }) {
  const parsing = useLiveEventsStore((state) => state.latestCvParsing);
  const pipeline = useLiveEventsStore((state) => state.latestPipelineUpdate);
  const connectionState = useLiveEventsStore((state) => state.connectionState);

  if (workspace === "candidate" && parsing) {
    const isSuccess = parsing.status === "SUCCESS";
    return <p style={{ ...noticeStyle, borderColor: isSuccess ? "#bfe4df" : "#fed7aa", background: isSuccess ? "#f1fbf9" : "#fff7ed", color: isSuccess ? "#0f5f59" : "#9a3412" }} aria-live="polite">
      {isSuccess ? "Your CV has been parsed. Your profile is ready to review." : "We could not finish reading your CV. Please upload it again."}
    </p>;
  }
  if (workspace === "recruiter" && pipeline) {
    return <p style={noticeStyle} aria-live="polite">
      Candidate pipeline updated: {pipeline.previousStage.replaceAll("_", " ")} → {pipeline.newStage.replaceAll("_", " ")}.
    </p>;
  }
  if (connectionState === "reconnecting") {
    return <p style={{ ...noticeStyle, borderColor: "#cbd5e1", background: "#f8fafc", color: "#475569" }} aria-live="polite">Reconnecting live updates…</p>;
  }
  return null;
}
