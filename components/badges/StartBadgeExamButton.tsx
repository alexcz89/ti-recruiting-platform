"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StartBadgeExamButtonProps = {
  templateId: string;
  label?: string;
  variant?: "solid" | "link";
};

export function StartBadgeExamButton({
  templateId,
  label = "Presentar examen",
  variant = "solid",
}: StartBadgeExamButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/badges/${templateId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data?.attemptId) {
        setError(data?.error || "No se pudo iniciar el examen");
        return;
      }
      router.push(
        `/assessments/${templateId}?attemptId=${encodeURIComponent(data.attemptId)}`
      );
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const buttonClass =
    variant === "link"
      ? "inline-flex min-h-[32px] items-center rounded-md px-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
      : "inline-flex min-h-[36px] items-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className={buttonClass}
      >
        {loading ? "Preparando..." : label}
      </button>
      {error && (
        <p className="max-w-[220px] text-right text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
