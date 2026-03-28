// components/dashboard/CandidateSummaryCard.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

type Props = {
  candidateId: string;
  jobId?: string | null;
};

type SummaryPayload = {
  headline?: string;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  suggestedQuestions?: string[];
  jobFitNotes?: string;
  missingSkillsNote?: string;
  tags?: string[];
  generatedAt?: string;
  source?: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeSummaryPayload(value: unknown): SummaryPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;

  const summaryText =
    typeof raw.summary === "string" ? raw.summary.trim() : "";

  const strengths = toStringArray(raw.strengths);
  const risks = toStringArray(raw.risks);
  const suggestedQuestions = toStringArray(raw.suggestedQuestions);
  const tags = toStringArray(raw.tags);

  const headline =
    typeof raw.headline === "string" && raw.headline.trim()
      ? raw.headline.trim()
      : "Resumen AI del candidato";

  const jobFitNotes =
    typeof raw.jobFitNotes === "string" && raw.jobFitNotes.trim()
      ? raw.jobFitNotes.trim()
      : undefined;

  const missingSkillsNote =
    typeof raw.missingSkillsNote === "string" && raw.missingSkillsNote.trim()
      ? raw.missingSkillsNote.trim()
      : undefined;

  const generatedAt =
    typeof raw.generatedAt === "string" && raw.generatedAt.trim()
      ? raw.generatedAt
      : undefined;

  const source =
    typeof raw.source === "string" && raw.source.trim()
      ? raw.source.trim()
      : undefined;

  return {
    headline,
    summary: summaryText,
    strengths,
    risks,
    suggestedQuestions,
    jobFitNotes,
    missingSkillsNote,
    tags,
    generatedAt,
    source,
  };
}

function buildSummaryUrl(candidateId: string, jobId?: string | null, force = false) {
  const url = new URL("/api/ai/candidate-summary", window.location.origin);
  url.searchParams.set("candidateId", candidateId);
  if (jobId) url.searchParams.set("jobId", jobId);
  if (force) url.searchParams.set("force", "1");
  return url.toString();
}

export default function CandidateSummaryCard({ candidateId, jobId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean | null>(null);

  const load = useCallback(
    async (force = false) => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(buildSummaryUrl(candidateId, jobId, force), {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "No se pudo generar el resumen");
        }

        const normalized = normalizeSummaryPayload(data?.summary);

        if (!normalized) {
          throw new Error("El resumen AI llegó en un formato inválido");
        }

        setSummary(normalized);
        setFromCache(Boolean(data?.fromCache));
        setOpen(true);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "No se pudo cargar el resumen AI";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [candidateId, jobId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const hasStrengths = (summary?.strengths?.length ?? 0) > 0;
  const hasRisks = (summary?.risks?.length ?? 0) > 0;
  const hasQuestions = (summary?.suggestedQuestions?.length ?? 0) > 0;
  const hasTags = (summary?.tags?.length ?? 0) > 0;

  const metaLabel = useMemo(() => {
    const parts: string[] = [];
    if (summary?.source) parts.push(summary.source);
    if (fromCache === true) parts.push("cache");
    return parts.join(" · ");
  }, [summary?.source, fromCache]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={() => {
            if (!summary && !loading) void load(false);
            else setOpen((v) => !v);
          }}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI Candidate Summary
            </div>
            {metaLabel ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {metaLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Resumen ejecutivo del perfil, fortalezas, riesgos y señales clave.
          </div>
        </button>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:w-auto dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
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
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-700/40 dark:bg-violet-950/20">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {summary.headline || "Resumen AI del candidato"}
              </h3>
            </div>

            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">
              {summary.summary || "No hay resumen disponible."}
            </p>

            {hasTags && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {summary.tags!.slice(0, 8).map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Fortalezas
              </h4>

              {hasStrengths ? (
                <ul className="space-y-1.5">
                  {summary.strengths!.map((s, i) => (
                    <li key={`${s}-${i}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Sin fortalezas destacadas disponibles.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Riesgos / Gaps
              </h4>

              {hasRisks ? (
                <ul className="space-y-1.5">
                  {summary.risks!.map((r, i) => (
                    <li key={`${r}-${i}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                      • {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Sin riesgos relevantes detectados.
                </p>
              )}
            </div>
          </div>

          {hasQuestions && (
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Preguntas sugeridas
              </h4>
              <ul className="space-y-1.5">
                {summary.suggestedQuestions!.map((q, i) => (
                  <li key={`${q}-${i}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.generatedAt && (
            <p className="text-[11px] text-zinc-400">
              Generado {new Date(summary.generatedAt).toLocaleString("es-MX")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}