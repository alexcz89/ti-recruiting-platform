// components/dashboard/MatchScorePopover.tsx
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Sparkles,
} from "lucide-react";
import MatchScoreBadge from "@/components/jobs/MatchScoreBadge";

interface SkillDetail {
  termId: string;
  label: string;
  must: boolean;
  weight: number;
  matched: boolean;
  candidateLevel: number | null;
  contribution: number;
}

interface MatchResult {
  score: number;
  label: "Muy alto" | "Alto" | "Medio" | "Bajo" | "Sin datos";
  skillScore: number;
  mustScore: number;
  niceScore: number;
  matchedCount: number;
  totalRequired: number;
  totalNice: number;
  details: SkillDetail[];
  seniorityFit?: "exact" | "close" | "below" | "unknown";
  experienceFit?: "meets" | "close" | "below" | "unknown";
  seniorityScore?: number;
  experienceScore?: number;
}

interface MatchExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
  interviewFocus: string[];
  recommendation: "STRONG_MATCH" | "REVIEW" | "WEAK_MATCH";
  generatedAt: string;
}

interface Props {
  score: number;
  matchResult: MatchResult;
  jobSkillCount: number;
  scoreColor: string;
  scoreTextColor: string;
  scoreLabel: string;
  candidateId?: string | null;
  jobId?: string | null;
}

const SKILL_LEVEL_LABEL: Record<number, string> = {
  1: "Básico",
  2: "Junior",
  3: "Intermedio",
  4: "Avanzado",
  5: "Experto",
};

function getSeniorityExplanation(fit?: MatchResult["seniorityFit"]) {
  if (!fit || fit === "unknown") return null;
  if (fit === "exact") return "El seniority coincide exactamente.";
  if (fit === "close") return "El seniority es cercano a lo solicitado.";
  return "El seniority está por debajo de lo ideal.";
}

function getExperienceExplanation(fit?: MatchResult["experienceFit"]) {
  if (!fit || fit === "unknown") return null;
  if (fit === "meets") return "La experiencia cumple o supera el mínimo.";
  if (fit === "close") return "La experiencia está cerca del mínimo requerido.";
  return "La experiencia está por debajo del mínimo esperado.";
}

function getRecommendation(score: number) {
  if (score >= 85) return "Fuerte candidato para avanzar.";
  if (score >= 65) return "Buen match para revisión prioritaria.";
  if (score >= 40) return "Match parcial; conviene validar gaps.";
  if (score > 0) return "Match bajo; revisar antes de avanzar.";
  return "No hay suficientes señales para evaluar.";
}

function recommendationPill(rec?: MatchExplanation["recommendation"]) {
  if (!rec) return null;

  const map = {
    STRONG_MATCH: {
      label: "Strong match",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300",
    },
    REVIEW: {
      label: "Review",
      cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300",
    },
    WEAK_MATCH: {
      label: "Weak match",
      cls: "border-red-200 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400",
    },
  }[rec];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${map.cls}`}>
      {map.label}
    </span>
  );
}

function buildExplanationUrl(candidateId: string, jobId: string) {
  return `/api/ai/match-explanation?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}`;
}

export default function MatchScorePopover({
  score,
  matchResult,
  jobSkillCount,
  scoreColor,
  scoreTextColor,
  scoreLabel,
  candidateId,
  jobId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<MatchExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFromCache, setAiFromCache] = useState<boolean | null>(null);
  const [aiLoadedOnce, setAiLoadedOnce] = useState(false);

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

  useEffect(() => {
    setAiExplanation(null);
    setAiLoading(false);
    setAiError(null);
    setAiFromCache(null);
    setAiLoadedOnce(false);
  }, [candidateId, jobId]);

  const loadAiExplanation = useCallback(async () => {
    if (!candidateId || !jobId) return;

    const cid: string = candidateId;
    const jid: string = jobId;

    try {
      setAiLoading(true);
      setAiError(null);

      const res = await fetch(buildExplanationUrl(cid, jid), {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo generar la explicación AI");
      }

      setAiExplanation((data?.explanation ?? null) as MatchExplanation | null);
      setAiFromCache(Boolean(data?.fromCache));
      setAiLoadedOnce(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "No se pudo cargar la explicación AI");
      setAiLoadedOnce(true);
    } finally {
      setAiLoading(false);
    }
  }, [candidateId, jobId]);

  useEffect(() => {
    if (!open) return;
    if (!candidateId || !jobId) return;
    if (aiLoadedOnce) return;

    const cid: string = candidateId;
    const jid: string = jobId;
    let cancelled = false;

    async function run() {
      try {
        setAiLoading(true);
        setAiError(null);

        const res = await fetch(buildExplanationUrl(cid, jid), {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "No se pudo generar la explicación AI");
        }

        if (!cancelled) {
          setAiExplanation((data?.explanation ?? null) as MatchExplanation | null);
          setAiFromCache(Boolean(data?.fromCache));
          setAiLoadedOnce(true);
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : "No se pudo cargar la explicación AI");
          setAiLoadedOnce(true);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [open, candidateId, jobId, aiLoadedOnce]);

  const matched = useMemo(
    () => matchResult.details.filter((d) => d.matched),
    [matchResult.details]
  );

  const missing = useMemo(
    () => matchResult.details.filter((d) => !d.matched),
    [matchResult.details]
  );

  const missingRequired = useMemo(
    () => missing.filter((d) => d.must),
    [missing]
  );

  const missingNice = useMemo(
    () => missing.filter((d) => !d.must),
    [missing]
  );

  const explanationLines = useMemo(() => {
    const lines: string[] = [];

    if (jobSkillCount > 0) {
      if (matchResult.matchedCount === jobSkillCount) {
        lines.push("Cubre todas las skills evaluadas.");
      } else if (matchResult.matchedCount > 0) {
        lines.push(
          `Coincide con ${matchResult.matchedCount} de ${jobSkillCount} skills evaluadas.`
        );
      } else {
        lines.push("No se detectaron skills alineadas en el match.");
      }

      if (matchResult.totalRequired > 0) {
        if (matchResult.mustScore >= 85) {
          lines.push("Las skills requeridas están bien cubiertas.");
        } else if (matchResult.mustScore >= 50) {
          lines.push("Las skills requeridas están cubiertas parcialmente.");
        } else {
          lines.push("Hay brecha importante en skills requeridas.");
        }
      }

      if (missingRequired.length > 0) {
        lines.push(
          `Faltan ${missingRequired.length} skill${
            missingRequired.length === 1 ? "" : "s"
          } requerida${missingRequired.length === 1 ? "" : "s"}.`
        );
      }
    }

    const seniorityText = getSeniorityExplanation(matchResult.seniorityFit);
    if (seniorityText) lines.push(seniorityText);

    const experienceText = getExperienceExplanation(matchResult.experienceFit);
    if (experienceText) lines.push(experienceText);

    if (lines.length === 0) {
      lines.push("No hay suficientes señales para explicar el match.");
    }

    return lines;
  }, [
    jobSkillCount,
    matchResult.matchedCount,
    matchResult.mustScore,
    matchResult.totalRequired,
    matchResult.seniorityFit,
    matchResult.experienceFit,
    missingRequired.length,
  ]);

  const seniorityBadge = () => {
    const f = matchResult.seniorityFit;
    if (!f || f === "unknown") return null;

    const cfg = {
      exact: {
        label: "Sen =",
        cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300",
      },
      close: {
        label: "Sen ~",
        cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300",
      },
      below: {
        label: "Sen ↓",
        cls: "border-red-200 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400",
      },
    }[f];

    return cfg ? (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
        {cfg.label}
      </span>
    ) : null;
  };

  const expBadge = () => {
    const f = matchResult.experienceFit;
    if (!f || f === "unknown") return null;

    const cfg = {
      meets: {
        label: "Exp =",
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

    return cfg ? (
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
        {cfg.label}
      </span>
    ) : null;
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
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
          <ChevronDown
            className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>

        <p className="text-[10px] text-zinc-500">
          {scoreLabel}
          {jobSkillCount > 0
            ? ` · ${matchResult.matchedCount}/${jobSkillCount} skills`
            : " · Seniority/experiencia"}
        </p>

        {(matchResult.seniorityFit !== "unknown" ||
          matchResult.experienceFit !== "unknown") && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {seniorityBadge()}
            {expBadge()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[340px] max-w-[calc(100vw-1rem)] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                Detalle AI Match
              </p>
              <p className="text-[11px] text-zinc-500">
                {jobSkillCount > 0
                  ? `${matchResult.matchedCount} de ${jobSkillCount} skills · ${score}%`
                  : `Señales de perfil · ${score}%`}
              </p>
            </div>
            <span className={`text-xl font-black ${scoreTextColor}`}>{score}</span>
          </div>

          <div className="max-h-[460px] space-y-4 overflow-y-auto p-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Explicación determinística
                </p>
              </div>

              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {getRecommendation(score)}
              </p>

              <ul className="mt-2 space-y-1.5">
                {explanationLines.map((line, idx) => (
                  <li key={`${line}-${idx}`} className="text-xs text-zinc-600 dark:text-zinc-300">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>

            {candidateId && jobId && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-700/40 dark:bg-violet-950/20">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Explicación AI
                  </p>
                  {aiFromCache === true && (
                    <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[9px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                      cache
                    </span>
                  )}
                </div>

                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-3 w-9/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                ) : aiExplanation ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {recommendationPill(aiExplanation.recommendation)}
                    </div>

                    <p className="text-xs text-zinc-700 dark:text-zinc-200">
                      {aiExplanation.summary}
                    </p>

                    {aiExplanation.strengths.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Fortalezas
                        </p>
                        <ul className="space-y-1">
                          {aiExplanation.strengths.map((item, idx) => (
                            <li
                              key={`${item}-${idx}`}
                              className="text-xs text-zinc-600 dark:text-zinc-300"
                            >
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiExplanation.gaps.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Gaps
                        </p>
                        <ul className="space-y-1">
                          {aiExplanation.gaps.map((item, idx) => (
                            <li
                              key={`${item}-${idx}`}
                              className="text-xs text-zinc-600 dark:text-zinc-300"
                            >
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiExplanation.interviewFocus.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Enfoque de entrevista
                        </p>
                        <ul className="space-y-1">
                          {aiExplanation.interviewFocus.map((item, idx) => (
                            <li
                              key={`${item}-${idx}`}
                              className="text-xs text-zinc-600 dark:text-zinc-300"
                            >
                              • {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="text-[10px] text-zinc-400">
                      Generado {new Date(aiExplanation.generatedAt).toLocaleString("es-MX")}
                    </p>
                  </div>
                ) : aiError ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No se pudo cargar la explicación AI.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAiLoadedOnce(false);
                        void loadAiExplanation();
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    La explicación AI aparecerá aquí.
                  </p>
                )}
              </div>
            )}

            {jobSkillCount > 0 && (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Breakdown
                  </p>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Skills globales</span>
                        <span>{matchResult.skillScore}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/60">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500"
                          style={{ width: `${matchResult.skillScore}%` }}
                        />
                      </div>
                    </div>

                    {matchResult.totalRequired > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Requeridas</span>
                          <span>{matchResult.mustScore}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/60">
                          <div
                            className="h-1.5 rounded-full bg-violet-500"
                            style={{ width: `${matchResult.mustScore}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {matchResult.totalNice > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Deseables</span>
                          <span>{matchResult.niceScore}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-700/60">
                          <div
                            className="h-1.5 rounded-full bg-sky-500"
                            style={{ width: `${matchResult.niceScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {matched.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Skills alineadas
                    </p>
                    <div className="space-y-1.5">
                      {matched.slice(0, 8).map((item) => (
                        <div
                          key={item.termId}
                          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 dark:border-emerald-700/30 dark:bg-emerald-950/20"
                        >
                          <div>
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                              {item.label}
                            </p>
                            {item.candidateLevel != null && (
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {SKILL_LEVEL_LABEL[item.candidateLevel] ?? `Nivel ${item.candidateLevel}`}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            +{item.contribution}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(missingRequired.length > 0 || missingNice.length > 0) && (
                  <div className="space-y-3">
                    {missingRequired.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Faltantes requeridas
                        </p>
                        <div className="space-y-1.5">
                          {missingRequired.slice(0, 8).map((item) => (
                            <div
                              key={item.termId}
                              className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/70 px-2 py-1.5 dark:border-red-700/30 dark:bg-red-950/20"
                            >
                              <div>
                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                  {item.label}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  Requerida
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold text-red-700 dark:text-red-300">
                                {item.weight} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {missingNice.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          <MinusCircle className="h-3.5 w-3.5 text-amber-500" />
                          Faltantes deseables
                        </p>
                        <div className="space-y-1.5">
                          {missingNice.slice(0, 8).map((item) => (
                            <div
                              key={item.termId}
                              className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1.5 dark:border-amber-700/30 dark:bg-amber-950/20"
                            >
                              <div>
                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                  {item.label}
                                </p>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  Deseable
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                {item.weight} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}