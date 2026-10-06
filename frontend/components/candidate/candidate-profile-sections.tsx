"use client";
import type { ReactNode } from "react";
export function Pencil({
  label,
  onClick,
  disabled = false,
  add = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  add?: boolean;
}) {
  return (
    <button
      type="button"
      className="profile-v2-icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {add ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="m15 4 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
        </svg>
      )}
    </button>
  );
}
export function ProfileSectionCard({
  id,
  title,
  children,
  actions,
}: {
  id: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      id={id}
      className="profile-v2-card scroll-mt-40"
      aria-labelledby={id + "-title"}
    >
      <div className="profile-v2-section-heading">
        <h2 id={id + "-title"}>{title}</h2>
        <div className="flex gap-1">{actions}</div>
      </div>
      {children}
    </section>
  );
}
