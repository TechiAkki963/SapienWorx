"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export function ProfileDrawer({
  title,
  children,
  onClose,
  dirty = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(
      typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
  const [discard, setDiscard] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      element?.close();
      requestAnimationFrame(() => opener.current?.focus());
    };
  }, []);
  function close() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="profile-v2-drawer"
      aria-labelledby="profile-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="profile-v2-drawer-head">
        <h2 id="profile-drawer-title">{title}</h2>
        <button
          type="button"
          autoFocus
          aria-label={`Close ${title}`}
          title={`Close ${title}`}
          className="profile-v2-icon"
          onClick={close}
          disabled={busy}
        >
          ×
        </button>
      </div>
      <div className="profile-v2-drawer-body">{children}</div>
      {discard && (
        <div className="profile-v2-actions">
          <p>Discard unsaved phone settings?</p>
          <button
            type="button"
            className="profile-v2-button"
            onClick={() => setDiscard(false)}
          >
            Keep editing
          </button>
          <button type="button" className="profile-v2-button" onClick={onClose}>
            Discard changes
          </button>
        </div>
      )}
    </dialog>
  );
}
