"use client";

import { useEffect } from "react";

export type ThemeMode = "system" | "light" | "dark";

export function readThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem("swx-theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("swx-dark", dark);
}

export function ThemeRuntime() {
  useEffect(() => {
    applyTheme(readThemeMode());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemeMode() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}
