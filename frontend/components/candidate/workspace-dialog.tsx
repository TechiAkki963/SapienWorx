"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function WorkspaceDialog({
  title,
  onClose,
  children,
  popover = false,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  popover?: boolean;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      requestAnimationFrame(
        () => opener.current?.isConnected && opener.current.focus(),
      );
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`candidate-dialog ${popover ? "candidate-popover" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            !busy &&
            (event.clientX < box.left ||
              event.clientX > box.right ||
              event.clientY < box.top ||
              event.clientY > box.bottom)
          )
            onClose();
        }
      }}
    >
      <div className="candidate-dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="candidate-icon-button"
          aria-label={`Close ${title}`}
          autoFocus
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
      </div>
      <div className="candidate-dialog-body">{children}</div>
    </dialog>
  );
}
