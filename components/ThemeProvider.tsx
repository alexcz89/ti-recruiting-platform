// components/ThemeProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeContext = createContext<Ctx | null>(null);

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Lee preferencia guardada o media-query en primer render del cliente
  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as Theme | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      applyTheme(stored);
      return;
    }
    // fallback: respeta prefers-color-scheme
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = prefersDark ? "dark" : "light";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement; // <html>
    root.classList.toggle("dark", t === "dark");
    // opcional: color de fondo del body si quieres
    document.body.classList.toggle("bg-zinc-950", t === "dark");
    document.body.classList.toggle("text-zinc-100", t === "dark");
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within AppThemeProvider");
  return ctx;
}
