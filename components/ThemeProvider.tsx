// components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void };

const ThemeCtx = createContext<Ctx>({
  theme: "light",
  toggle: () => {},
  setTheme: () => {},
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, _setTheme] = useState<Theme>("light");

  const apply = (t: Theme) => {
    _setTheme(t);
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.dataset.theme = t;
    localStorage.setItem("theme", t);
  };

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) || null;
    const preferred: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    apply(stored ?? preferred);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) apply(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggle: () => apply(theme === "dark" ? "light" : "dark"),
      setTheme: (t: Theme) => apply(t),
    }),
    [theme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  try {
    var stored = localStorage.getItem('theme');
    var t = stored ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    root.dataset.theme = t;
  } catch(e) {}
})();`,
      }}
    />
  );
}

// ⬅️ Export por default para que Providers.tsx pueda importarlo como AppThemeProvider
export default ThemeProvider;
export { ThemeProvider };
