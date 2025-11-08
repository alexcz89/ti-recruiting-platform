// components/ThemeToggle.tsx
"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="
        inline-flex items-center justify-center gap-2
        h-9 w-auto rounded-md border
        border-zinc-200/70 dark:border-zinc-700/60
        bg-white/60 dark:bg-zinc-900/60
        px-3 text-sm font-medium
        text-zinc-700 dark:text-zinc-300
        hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70
        transition-colors duration-200
      "
      title={isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
      aria-label="Cambiar tema"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4" />
          <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          <span className="hidden sm:inline">Oscuro</span>
        </>
      )}
    </button>
  );
}
