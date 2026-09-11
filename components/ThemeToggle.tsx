// components/ThemeToggle.tsx
"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center rounded-md border border-zinc-200/70 bg-white/60 text-zinc-700 transition-colors duration-200 hover:bg-zinc-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-zinc-700/60 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800/70 ${
        compact ? "h-11 w-11 p-0 md:h-9 md:w-9" : "h-9 w-auto gap-2 px-3 text-sm font-medium"
      }`}
      title={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Claro</span>}
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Oscuro</span>}
        </>
      )}
    </button>
  );
}
