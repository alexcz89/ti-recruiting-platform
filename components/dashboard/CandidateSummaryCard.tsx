// components/dashboard/CandidateSummaryCard.tsx
"use client";

import { useState, useEffect } from "react";

type Props = {
  candidateId: string;
  jobId?: string | null;
};

type SummaryPayload = {
  headline: string;
  summary: string;
  strengths: string[];
  risks: string[];
  suggestedQuestions: string[];
  jobFitNotes?: string;
  missingSkillsNote?: string;
  generatedAt: string;
};

export default function CandidateSummaryCard({ candidateId, jobId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  void load(false);
}, []);

  async function load(force = false) {
    try {
      setLoading(true);
      setError(null);

      const url = new URL("/api/ai/candidate-summary", window.location.origin);
      url.searchParams.set("candidateId", candidateId);
      if (jobId) url.searchParams.set("jobId", jobId);
      if (force) url.searchParams.set("force", "1");

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "No se pudo generar el resumen");
      setSummary(data.summary);
      setOpen(true);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (!summary && !loading) void load(false);
            else setOpen((v) => !v);
          }}
          className="flex-1 text-left"
        >
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AI Candidate Summary
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Resumen ejecutivo del perfil y preguntas sugeridas.
          </div>
        </button>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {loading ? "Generando..." : "Regenerar"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {open && summary && (
        <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {summary.headline}
            </h3>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
              {summary.summary}
            </p>
          </div>

          {summary.jobFitNotes && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
              {summary.jobFitNotes}
            </div>
          )}

          {summary.missingSkillsNote && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              {summary.missingSkillsNote}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Fortalezas
              </h4>
              <ul className="space-y-1">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-zinc-700 dark:text-zinc-200">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Riesgos / Gaps
              </h4>
              <ul className="space-y-1">
                {summary.risks.length ? (
                  summary.risks.map((r, i) => (
                    <li key={i} className="text-sm text-zinc-700 dark:text-zinc-200">
                      • {r}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-zinc-500 dark:text-zinc-400">
                    Sin riesgos relevantes detectados.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Preguntas sugeridas
            </h4>
            <ol className="list-decimal space-y-1 pl-5">
              {summary.suggestedQuestions.map((q, i) => (
                <li key={i} className="text-sm text-zinc-700 dark:text-zinc-200">
                  {q}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}