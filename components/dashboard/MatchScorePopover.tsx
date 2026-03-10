// components/dashboard/MatchScorePopover.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import MatchScoreBadge from "@/components/jobs/MatchScoreBadge";

interface SkillDetail {
  termId: string;
  label: string;
  must: boolean;
  matched: boolean;
  candidateLevel?: number | null;
  jobWeight?: number | null;
}

interface MatchResult {
  score: number;
  matchedCount: number;
  details: SkillDetail[];
  seniorityFit?: "exact" | "close" | "low" | "unknown";
  experienceFit?: "meets" | "close" | "below" | "unknown";
}

interface Props {
  score: number;
  matchResult: MatchResult;
  jobSkillCount: number;
  scoreColor: string;
  scoreTextColor: string;
  scoreLabel: string;
}

const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

export default function MatchScorePopover({
  score,
  matchResult,
  jobSkillCount,
  scoreColor,
  scoreTextColor,
  scoreLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const matched = matchResult.details.filter((d) => d.matched);
  const missing = matchResult.details.filter((d) => !d.matched);
  const missingRequired = missing.filter((d) => d.must);
  const missingNice = missing.filter((d) => !d.must);

  const seniorityBadge = () => {
    const f = matchResult.seniorityFit;
    if (!f || f === "unknown") return null;
    const cfg = {
      exact: {
        label: "Seniority ✓",
        cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300",
      },
      close: {
        label: "Seniority ~",
        cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300",
      },
      low: {
        label: "Seniority ↓",
        cls: "border-red-200 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400",
      },
    }[f];

    return cfg ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span> : null;
  };

  const expBadge = () => {
    const f = matchResult.experienceFit;
    if (!f || f === "unknown") return null;
    const cfg = {
      meets: {
        label: "Exp ✓",
        cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300",
      },
      close: {
        label: "Exp ~",
        cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300",
      },
      below: {
        label: "Exp ↓",
        cls: "border-red-200 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400",
      },
    }[f];

    return cfg ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span> : null;
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex min-w-[120px] flex-col gap-1 rounded-lg px-1.5 py-1 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
      >
        <div className="flex items-center gap-1.5">
          <MatchScoreBadge
            score={score}
            label={scoreLabel}
            scoreColor={scoreColor}
            scoreTextColor={scoreTextColor}
            compact
          />
          <ChevronDown className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>

        <p className="text-[10px] text-zinc-500">
          {scoreLabel}
          {jobSkillCount > 0 ? ` · ${matchResult.matchedCount}/${jobSkillCount} skills` : " · Seniority/experiencia"}
        </p>

        {(matchResult.seniorityFit !== "unknown" || matchResult.experienceFit !== "unknown") && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {seniorityBadge()}
            {expBadge()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Detalle AI Match</p>
              <p className="text-[11px] text-zinc-500">
                {jobSkillCount > 0
                  ? `${matchResult.matchedCount} de ${jobSkillCount} skills · ${score}%`
                  : `Señales de perfil · ${score}%`}
              </p>
            </div>
            <span className={`text-xl font-black ${scoreTextColor}`}>{score}</span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 p-3">
            {(matchResult.seniorityFit !== "unknown" || matchResult.experienceFit !== "unknown") && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Perfil</p>
                <div className="flex flex-wrap gap-1.5">
                  {seniorityBadge()}
                  {expBadge()}
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Tiene ({matched.length})
                </p>
                <div className="space-y-1">
                  {matched.map((d) => (
                    <div key={d.termId} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span className="truncate text-xs text-zinc-700 dark:text-zinc-200">{d.label}</span>
                        {d.must && (
                          <span className="shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            REQ
                          </span>
                        )}
                      </div>
                      {d.candidateLevel != null && (
                        <span className="shrink-0 text-[10px] text-zinc-400">
                          {SKILL_LEVEL_LABEL[d.candidateLevel] ?? `L${d.candidateLevel}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {missingRequired.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Falta — Requeridas ({missingRequired.length})
                </p>
                <div className="space-y-1">
                  {missingRequired.map((d) => (
                    <div key={d.termId} className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="truncate text-xs text-zinc-600 dark:text-zinc-300">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {missingNice.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Falta — Deseables ({missingNice.length})
                </p>
                <div className="space-y-1">
                  {missingNice.map((d) => (
                    <div key={d.termId} className="flex items-center gap-1.5">
                      <MinusCircle className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
                      <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">{d.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matched.length === 0 && missing.length === 0 && (
              <p className="text-xs text-zinc-400">Sin detalle de skills disponible.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}