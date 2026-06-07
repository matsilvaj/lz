"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const storageKey = "lz-theme";

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4V2.75M12 21.25V20M17.66 6.34l.88-.88M5.46 18.54l.88-.88M20 12h1.25M2.75 12H4M17.66 17.66l.88.88M5.46 5.46l.88.88"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20.25 14.16A7.72 7.72 0 0 1 9.84 3.75 8.5 8.5 0 1 0 20.25 14.16Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const storedTheme =
      window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";

    applyTheme(storedTheme);

    const frame = window.requestAnimationFrame(() => {
      setTheme(storedTheme);
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      aria-label={
        mounted && theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"
      }
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/20 hover:bg-white/8 hover:text-[var(--text-primary)]"
      onClick={toggleTheme}
      title={mounted && theme === "light" ? "Tema escuro" : "Tema claro"}
      type="button"
    >
      {mounted && theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
