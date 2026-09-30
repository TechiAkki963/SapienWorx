"use client";

import { useEffect, useState } from "react";

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
  }

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={compact
        ? "inline-flex items-center rounded-xl border border-line bg-surface p-1 shadow-sm"
        : "inline-flex items-center rounded-2xl border border-line bg-surface p-1.5 shadow-sm"}
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
              compact ? "h-8 min-w-8 px-2 text-[11px]" : "h-9 min-w-9 gap-1.5 px-2.5 text-xs",
              active ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
            ].join(" ")}
          >
            <span aria-hidden="true">{option.icon}</span>
            {!compact && <span className="hidden xl:inline">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
