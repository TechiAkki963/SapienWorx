"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
/** A non-modal navigation popover: Escape restores focus, Tab can leave it. */
export function CandidatePopover({ label, title, trigger, children, className = "", placement = "below", current = false }: {
    label: string;
    title: string;
    trigger: ReactNode;
    children: (close: () => void) => ReactNode;
    className?: string;
    placement?: "below" | "beside";
    current?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const anchor = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
    const id = useId();
    useEffect(() => {
        if (!open)
            return;
        const update = () => {
            const box = anchor.current?.getBoundingClientRect();
            if (!box)
                return;
            const width = Math.min(320, innerWidth - 24);
            const left = placement === "beside" && innerWidth >= 768 ? box.right + 12 : box.right - width;
            const height = panel.current?.offsetHeight || 360;
            const top = placement === "beside" && innerWidth >= 768 ? box.bottom - height : box.bottom + 8;
            setPosition({ left: Math.max(12, Math.min(left, innerWidth - width - 12)), top: Math.max(12, Math.min(top, innerHeight - height - 12)) });
        };
        update();
        const frame = requestAnimationFrame(() => { update(); panel.current?.querySelector<HTMLElement>("a,button")?.focus(); });
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                anchor.current?.focus();
            }
        };
        const outside = (event: PointerEvent) => {
            if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node))
                setOpen(false);
        };
        const focus = (event: FocusEvent) => {
            if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node))
                setOpen(false);
        };
        document.addEventListener("keydown", escape);
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", focus);
        window.addEventListener("resize", update);
        return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", focus); window.removeEventListener("resize", update); };
    }, [open, placement]);
    return <>
    <button ref={anchor} type="button" className={className} aria-label={label} title={label} aria-current={current ? "page" : undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>{trigger}</button>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} className="candidate-navigation-popover" style={position}>
      <h2 id={`${id}-title`} className="sr-only">{title}</h2>
      {children(() => setOpen(false))}
    </div>, document.body)}
  </>;
}
