"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCandidateWorkspace } from "./candidate-workspace-state";

export function MarkReadButton({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { markRead } = useCandidateWorkspace();
  if (read)
    return <span className="text-xs font-semibold text-ink-muted">Read</span>;
  return (
    <div>
      <button
        type="button"
        className="min-h-11 text-xs font-bold text-indigo hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            await markRead(id);
            router.refresh();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not mark this update read.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Updating…" : "Mark read"}
      </button>
      {error && (
        <p role="alert" className="candidate-error">
          {error}
        </p>
      )}
    </div>
  );
}
