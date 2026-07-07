// app/certificaciones/StartBadgeExamButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartBadgeExamButton({ templateId }: { templateId: string }) {
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
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className="inline-flex min-h-[36px] items-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? "Preparando..." : "Presentar examen"}
      </button>
      {error && (
        <p className="max-w-[200px] text-right text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
