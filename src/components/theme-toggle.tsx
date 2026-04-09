"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-btn"
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={dark ? "Açık tema" : "Koyu tema"}
      style={{ fontSize: "1.1rem", borderRadius: "var(--radius-full)" }}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
