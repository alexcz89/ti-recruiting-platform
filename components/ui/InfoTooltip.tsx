// components/ui/InfoTooltip.tsx
import React from "react";

type InfoTooltipProps = {
  text: string;
  ariaLabel?: string;
  className?: string;
};

export function InfoTooltip({
  text,
  ariaLabel = "Más información",
  className = "",
}: InfoTooltipProps) {
  return (
    <div className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition cursor-pointer"
        aria-label={ariaLabel}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      <div className="absolute left-0 top-full mt-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
        <div className="relative bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg px-3 py-2 shadow-lg">
          <div className="absolute -top-1 left-4 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45" />
          {text}
        </div>
      </div>
    </div>
  );
}
