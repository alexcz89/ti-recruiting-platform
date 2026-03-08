// components/jobs/CandidateMatchCard.tsx
// Tarjeta de AI Match para candidatos en la página pública de vacante
// Server-rendered: recibe el resultado ya calculado como prop

import Link from "next/link";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import {
  scoreToColor,
  scoreToTextColor,
  scoreToLabel,
  type MatchResult,
} from "@/lib/ai/matchScore";

type Props = {
  matchResult: MatchResult;
  jobId: string;
};

export default function CandidateMatchCard({ matchResult, jobId }: Props) {
  const { score, label, mustScore, niceScore, matchedCount, totalRequired, totalNice, details } = matchResult;

  const matched = details.filter((d) => d.matched);
  const missingReq = details.filter((d) => !d.matched && d.must);
  const missingNice = details.filter((d) => !d.matched && !d.must);
  const totalSkills = totalRequired + totalNice;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 dark:border-emerald-700/40 dark:bg-emerald-950/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          Tu compatibilidad con esta vacante
        </h2>
      </div>

      {/* Score + Barras: siempre horizontal (score a la izq, barras a la der) */}
      <div className="flex items-center gap-4">
        {/* Score — ancho fijo, no crece */}
        <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-white py-3 dark:border-emerald-700/40 dark:bg-zinc-900/60">
          <span className={`text-3xl font-black leading-none ${scoreToTextColor(score)}`}>
            {score}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
            / 100
          </span>
          <span className="mt-1 px-1 text-center text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
          <span className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            {matchedCount}/{totalSkills}
          </span>
        </div>

        {/* Barras — ocupan espacio restante */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>General</span>
              <span className={`font-medium ${scoreToTextColor(score)}`}>{score}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/40">
              <div className={`h-2 rounded-full ${scoreToColor(score)}`} style={{ width: `${score}%` }} />
            </div>
          </div>

          {totalRequired > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Requeridas ({totalRequired})</span>
                <span className="font-medium">{mustScore}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/40">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${mustScore}%` }} />
              </div>
            </div>
          )}

          {totalNice > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Deseables ({totalNice})</span>
                <span className="font-medium">{niceScore}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/40">
                <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${niceScore}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown */}
      {totalSkills > 0 && (matched.length > 0 || missingReq.length > 0 || missingNice.length > 0) && (
        <div className="mt-4 space-y-3 border-t border-emerald-200/60 pt-4 dark:border-emerald-700/30 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          {matched.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                ✓ Tienes ({matched.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matched.map((d) => (
                  <span
                    key={d.termId}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      d.must
                        ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-200"
                        : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span className="max-w-[120px] truncate">{d.label}</span>
                    {d.candidateLevel && (
                      <span className="shrink-0 opacity-50">L{d.candidateLevel}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(missingReq.length > 0 || missingNice.length > 0) && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                ✗ Te faltan ({missingReq.length + missingNice.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingReq.map((d) => (
                  <span
                    key={d.termId}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300"
                  >
                    <XCircle className="h-3 w-3 shrink-0" />
                    <span className="max-w-[120px] truncate">{d.label}</span>
                    <span className="shrink-0 text-[9px] font-bold uppercase opacity-60">Req</span>
                  </span>
                ))}
                {missingNice.map((d) => (
                  <span
                    key={d.termId}
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400"
                  >
                    <XCircle className="h-3 w-3 shrink-0 opacity-40" />
                    <span className="max-w-[120px] truncate">{d.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA si match bajo */}
      {score < 50 && missingReq.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200">
          <span className="font-semibold">Tip:</span> Cubre {mustScore}% de las skills requeridas.{" "}
          <Link href="/profile/edit" className="font-semibold underline underline-offset-2 hover:no-underline">
            Actualiza tu perfil →
          </Link>
        </div>
      )}
    </div>
  );
}