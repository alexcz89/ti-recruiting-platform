// lib/ai/matchScore.ts
// ============================================================
// AI Match Score Engine — TaskIO
// Compara JobRequiredSkill[] vs CandidateSkill[]
// Score 0-100, breakdown por skill, gate de plan
// ============================================================

export type JobSkillInput = {
  termId: string;
  label: string;
  must: boolean;
  weight?: number | null;
};

export type CandidateSkillInput = {
  termId: string;
  label: string;
  level?: number | null;
};

export type SkillMatchDetail = {
  termId: string;
  label: string;
  must: boolean;
  weight: number;
  candidateLevel: number | null;
  matched: boolean;
  contribution: number;
};

export type MatchResult = {
  score: number;
  label: MatchLabel;
  mustScore: number;
  niceScore: number;
  matchedCount: number;
  totalRequired: number;
  totalNice: number;
  details: SkillMatchDetail[];
};

export type MatchLabel = "Muy alto" | "Alto" | "Medio" | "Bajo" | "Sin datos";

export function computeMatchScore(
  jobSkills: JobSkillInput[],
  candidateSkills: CandidateSkillInput[]
): MatchResult {
  const empty: MatchResult = {
    score: 0, label: "Sin datos",
    mustScore: 0, niceScore: 0,
    matchedCount: 0, totalRequired: 0, totalNice: 0,
    details: [],
  };
  if (!jobSkills.length) return empty;

  const candMap = new Map<string, CandidateSkillInput>();
  for (const cs of candidateSkills) candMap.set(cs.termId, cs);

  const details: SkillMatchDetail[] = [];
  const mustSkills = jobSkills.filter((s) => s.must);
  const niceSkills = jobSkills.filter((s) => !s.must);

  let mustPoints = 0, mustMax = 0, nicePoints = 0, niceMax = 0, matchedCount = 0;

  for (const js of jobSkills) {
    const w = js.weight ?? 5;
    const cand = candMap.get(js.termId);
    const matched = !!cand;
    // nivel 5 = 100%, nivel 3 = 80%, nivel 1 = 60%, sin nivel = 80%
    const levelMultiplier = matched
      ? cand!.level ? 0.6 + (cand!.level / 5) * 0.4 : 0.8
      : 0;
    const contribution = w * levelMultiplier;

    if (js.must) { mustMax += w; mustPoints += contribution; }
    else          { niceMax += w; nicePoints += contribution; }
    if (matched) matchedCount++;

    details.push({
      termId: js.termId, label: js.label, must: js.must, weight: w,
      candidateLevel: cand?.level ?? null,
      matched, contribution: Math.round(contribution * 10) / 10,
    });
  }

  const mustPct = mustMax > 0 ? (mustPoints / mustMax) * 100 : 100;
  const nicePct = niceMax > 0 ? (nicePoints / niceMax) * 100 : 100;
  const hasMust = mustSkills.length > 0;
  const hasNice = niceSkills.length > 0;

  let score: number;
  if (hasMust && hasNice)  score = mustPct * 0.7 + nicePct * 0.3;
  else if (hasMust)        score = mustPct;
  else                     score = nicePct;
  score = Math.round(Math.max(0, Math.min(100, score)));

  return {
    score, label: scoreToLabel(score),
    mustScore: Math.round(mustPct), niceScore: Math.round(nicePct),
    matchedCount, totalRequired: mustSkills.length, totalNice: niceSkills.length,
    details,
  };
}

export function scoreToLabel(score: number): MatchLabel {
  if (score >= 85) return "Muy alto";
  if (score >= 65) return "Alto";
  if (score >= 40) return "Medio";
  if (score > 0)   return "Bajo";
  return "Sin datos";
}

export function scoreToColor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-emerald-400";
  if (score >= 40) return "bg-yellow-400";
  if (score > 0)   return "bg-orange-400";
  return "bg-zinc-300";
}

export function scoreToTextColor(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 65) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-yellow-700 dark:text-yellow-400";
  if (score > 0)   return "text-orange-600 dark:text-orange-400";
  return "text-zinc-400";
}

export type BillingPlan = "FREE" | "STARTER" | "PRO";

export function getMatchScoreLimit(plan: BillingPlan): number {
  if (plan === "PRO") return Infinity;
  if (plan === "STARTER") return 5;
  return 0;
}

export function applyPlanGate(
  score: number,
  rank: number,
  plan: BillingPlan
): number | null {
  return rank < getMatchScoreLimit(plan) ? score : null;
}