"use client";
import { useState } from "react";
import { useCandidateWorkspace } from "./candidate-workspace-state";

export function CandidateAvatar({
  name,
  className = "",
  image,
}: {
  name?: string;
  className?: string;
  image?: string | null;
}) {
  const { identity } = useCandidateWorkspace();
  const fullName = identity?.full_name || name || "Candidate";
  const source = identity ? identity.photo_data_url : image;
  const [failed, setFailed] = useState<string | null>(null);
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "C";
  return (
    <span className={`candidate-avatar ${className}`}>
      {source && source !== failed ? (
        <img
          src={source}
          alt={`${fullName} profile photo`}
          onError={() => setFailed(source)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
