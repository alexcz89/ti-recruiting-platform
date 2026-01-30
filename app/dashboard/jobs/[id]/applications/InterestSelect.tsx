// app/dashboard/jobs/[id]/applications/InterestSelect.tsx
"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";

type InterestKey = "REVIEW" | "MAYBE" | "ACCEPTED" | "REJECTED";

const LABEL: Record<InterestKey, string> = {
  REVIEW: "En revisión",
  MAYBE: "En duda",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
};

// 🔔 MAPEO A STATUS DE LA APLICACIÓN (para notificaciones)
const TO_APPLICATION_STATUS: Record<InterestKey, string> = {
  REVIEW: "REVIEWING",
  MAYBE: "REVIEWING", // En duda también es "revisando"
  ACCEPTED: "OFFER",  // Aceptado = oferta
  REJECTED: "REJECTED",
};

const INTEREST_KEYS: InterestKey[] = [
  "REVIEW",
  "MAYBE",
  "ACCEPTED",
  "REJECTED",
];

// 🎨 Fondo + borde + texto del pill principal (según estado)
const COLOR_CLASSES: Record<InterestKey, string> = {
  REVIEW:
    "bg-zinc-100 text-zinc-700 border-zinc-300 " +
    "dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600",
  MAYBE:
    "bg-amber-100 text-amber-800 border-amber-300 " +
    "dark:bg-amber-500/25 dark:text-amber-50 dark:border-amber-500/60",
  ACCEPTED:
    "bg-emerald-100 text-emerald-800 border-emerald-400 " +
    "dark:bg-emerald-500/25 dark:text-emerald-50 dark:border-emerald-500/60",
  REJECTED:
    "bg-rose-100 text-rose-800 border-rose-300 " +
    "dark:bg-rose-500/25 dark:text-rose-50 dark:border-rose-500/60",
};

// Puntito de color en el menú
const DOT_COLOR: Record<InterestKey, string> = {
  REVIEW: "bg-zinc-400",
  MAYBE: "bg-amber-500",
  ACCEPTED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
};

export default function InterestSelect({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial: InterestKey;
}) {
  const router = useRouter();
  const [value, setValue] = useState<InterestKey>(initial);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function updateInterest(next: InterestKey) {
    const prev = value;
    setValue(next); // UI optimista

    try {
      // 🔔 LLAMAR AL ENDPOINT DE STATUS (que tiene notificaciones)
      const applicationStatus = TO_APPLICATION_STATUS[next];
      
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: applicationStatus }),
      });

      if (!res.ok) throw new Error(await res.text());

      // Luego actualizar el recruiterInterest (para la UI)
      await fetch(`/api/applications/${applicationId}/interest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterInterest: next }),
      });

      toastSuccess("Nivel de interés actualizado");
      router.refresh();
    } catch (err) {
      setValue(prev);
      toastError("No se pudo actualizar");
      console.error(err);
    }
  }

  const handleSelect = (next: InterestKey) => {
    setOpen(false);
    if (next === value) return;
    startTransition(() => updateInterest(next));
  };

  const handleToggle = () => {
    if (isPending) return;
    setOpen((o) => !o);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;

    function onClickOutside(ev: MouseEvent<Document>) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside as any);
    return () =>
      document.removeEventListener("mousedown", onClickOutside as any);
  }, [open]);

  const baseButtonClasses =
    "inline-flex h-8 min-w-[150px] items-center justify-between rounded-full " +
    "border px-3 text-xs font-medium shadow-sm " +
    "transition-colors transition-shadow " +
    "cursor-pointer select-none " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-emerald-500/70 focus-visible:ring-offset-1 " +
    "dark:focus-visible:ring-offset-zinc-900 " +
    "disabled:opacity-60 disabled:cursor-default";

  return (
    <div
      ref={containerRef}
      className="relative inline-flex flex-col text-xs"
    >
      {/* Botón pill con color por estado */}
      <button
        type="button"
        className={`${baseButtonClasses} ${COLOR_CLASSES[value]}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{LABEL[value]}</span>
        <span className="ml-2 text-[10px] text-zinc-600 dark:text-zinc-300">
          ▾
        </span>
      </button>

      {/* Menú: ahora es un bloque normal debajo del botón (no absoluto) */}
      {open && (
        <div
          className={`
            mt-1 w-full min-w-[170px]
            rounded-xl border border-zinc-200/80 bg-white/95
            shadow-lg shadow-zinc-900/10 backdrop-blur-sm
            dark:bg-zinc-900/95 dark:border-zinc-700 dark:shadow-black/40
          `}
          role="listbox"
        >
          {INTEREST_KEYS.map((key) => {
            const isActive = key === value;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(key)}
                className={`
                  flex w-full items-center justify-between gap-2 px-3 py-2
                  text-left text-[11px] transition-colors
                  ${
                    isActive
                      ? "bg-zinc-50 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${DOT_COLOR[key]}`}
                    aria-hidden
                  />
                  {LABEL[key]}
                </span>
                {isActive && (
                  <span className="text-[10px] text-emerald-500">●</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}