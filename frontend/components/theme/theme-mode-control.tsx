"use client";

import { useEffect, useRef, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const options: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "◐" },
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
];

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("swx-dark", dark);
}

export function ThemeModeControl({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const compactMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("swx-theme");
    const initial: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setMode(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("swx-theme") || "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemeMode) {
    localStorage.setItem("swx-theme", next);
    setMode(next);
    applyTheme(next);
    if (compactMenuRef.current) compactMenuRef.current.open = false;
  }

  if (compact) {
    const current = options.find((option) => option.value === mode) ?? options[0];
    return (
      <details ref={compactMenuRef} className="relative shrink-0">
        <summary
          aria-label={"Appearance: " + current.label}
          title="Appearance"
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-surface text-sm font-bold text-ink-muted shadow-sm transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden="true">{current.icon}</span>
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_44px_rgba(16,33,63,0.16)]">
          {options.map((option) => {
            const active = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                title={option.label + " mode"}
                onClick={() => choose(option.value)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo",
                  active ? "bg-indigo text-white" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
                ].join(" ")}
              >
                <span aria-hidden="true">{option.icon}</span><span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </details>
    );
  }

  return (
    <div
      role="group"
      aria-label="Appearance"
      className="inline-flex items-center rounded-2xl border border-line bg-surface p-1.5 shadow-sm"
    >
      {options.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label + " mode"}
            onClick={() => choose(option.value)}
            className={[
              "inline-flex items-center justify-center rounded-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo",
              "h-9 min-w-9 gap-1.5 px-2.5 text-xs",
              active ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
            ].join(" ")}
          >
            <span aria-hidden="true">{option.icon}</span>
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
