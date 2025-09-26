// components/ThemeToggle.tsx
"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
      title={theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
      aria-label="Tema"
    >
      {theme === "dark" ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
