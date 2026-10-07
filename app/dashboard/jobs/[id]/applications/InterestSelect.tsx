// app/dashboard/jobs/[id]/applications/InterestSelect.tsx
"use client";

import React, {
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
  REVIEW: "Por revisar",
  MAYBE: "Preselecto",
  ACCEPTED: "Entrevista",
  REJECTED: "Descartado",
};

// 🔔 MAPEO A STATUS DE LA APLICACIÓN (para notificaciones)
const TO_APPLICATION_STATUS: Record<"REVIEW" | "MAYBE", string> = {
  REVIEW: "REVIEWING",
  MAYBE: "REVIEWING", // En duda también es "revisando"
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
    "bg-sky-100 text-sky-800 border-sky-300 " +
    "dark:bg-sky-500/25 dark:text-sky-50 dark:border-sky-500/60",
  REJECTED:
    "bg-rose-100 text-rose-800 border-rose-300 " +
    "dark:bg-rose-500/25 dark:text-rose-50 dark:border-rose-500/60",
};

// Puntito de color en el menú
const DOT_COLOR: Record<InterestKey, string> = {
  REVIEW: "bg-zinc-400",
  MAYBE: "bg-amber-500",
  ACCEPTED: "bg-sky-500",
  REJECTED: "bg-rose-500",
};

export default function InterestSelect({
  applicationId,
  initial,
  initialStateVersion,
  legacyStatus = "",
  canonicalStage = null,
  canonicalDisposition = null,
}: {
  applicationId: string;
  initial: InterestKey;
  initialStateVersion: number;
  legacyStatus?: string;
  canonicalStage?: string | null;
  canonicalDisposition?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<InterestKey>(initial);
  const [stateVersion, setStateVersion] = useState(initialStateVersion);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canonicalOffer =
    canonicalStage === "OFFER" && canonicalDisposition === "ACTIVE";
  const terminalHired =
    legacyStatus === "HIRED" ||
    (canonicalStage === "CLOSED" && canonicalDisposition === "HIRED");

  async function updateInterest(next: InterestKey) {
    if (terminalHired) return;
    const prev = value;
    setValue(next); // UI optimista

    try {
      if (next === "ACCEPTED" || next === "REJECTED") {
        const res = await fetch(`/api/applications/${applicationId}/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: next === "ACCEPTED" ? "MOVE_TO_INTERVIEW" : "REJECT_CANDIDATE",
            expectedVersion: stateVersion,
            commandId: crypto.randomUUID(),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setStateVersion(data.application.stateVersion);
        toastSuccess("Nivel de interés actualizado");
        router.refresh();
        return;
      }

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
    if (terminalHired) return;
    if (value === "REJECTED") return;
    if (canonicalOffer && next !== "REJECTED") return;
    if (next === value) return;
    startTransition(() => updateInterest(next));
  };

  const handleToggle = () => {
    if (isPending || terminalHired) return;
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
    "inline-flex h-8 min-w-[150px] items-center gap-2 rounded-full " +
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
        disabled={isPending || terminalHired}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[value]}`} aria-hidden />
        <span className="flex-1 truncate text-left">{LABEL[value]}</span>
        <span className="shrink-0 text-[10px] opacity-60">▾</span>
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
            const blockedByCanonicalOffer = canonicalOffer && key !== "REJECTED";
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={blockedByCanonicalOffer || terminalHired}
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
                  disabled:cursor-not-allowed disabled:opacity-50
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
