// components/dashboard/AssessmentsBadge.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ClipboardCheck, X } from "lucide-react";

interface Props {
  titles: string[];
}

export default function AssessmentsBadge({ titles }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Touch support para mobile
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick as any);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick as any);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      {/* Badge */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer min-h-[32px]"
      >
        <ClipboardCheck className="h-3 w-3 shrink-0" />
        ✓ {titles.length} template{titles.length !== 1 ? "s" : ""}
      </button>

      {/* Popover — abre hacia ABAJO, nunca tapa el nombre de la vacante */}
      {open && (
        <>
          {/* Overlay mobile para cerrar tocando fuera */}
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div className="
            absolute left-0 z-50 bottom-full mb-2
            w-[calc(100vw-2rem)] max-w-[260px]
            rounded-xl border border-zinc-200 bg-white
            dark:border-zinc-700 dark:bg-zinc-900
            shadow-xl ring-1 ring-black/5
            sm:w-64
          ">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-3 py-2">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Assessments asignados
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Lista */}
            <ul className="px-3 py-2.5 space-y-2">
              {titles.map((title, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <ClipboardCheck className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span className="text-xs text-zinc-700 dark:text-zinc-200 leading-snug break-words">
                    {title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}