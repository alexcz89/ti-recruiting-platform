// lib/ai/matchScore.ts
// ============================================================
// AI Match Score Engine — TaskIO
// Compara JobRequiredSkill[] vs CandidateSkill[]
// Score 0-100, breakdown por skill + seniority + experience
// Gate de plan FREE/STARTER/PRO
// ============================================================

// ── Types ─────────────────────────────────────────────────────────────────

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

export type SeniorityLevel = "junior" | "mid" | "senior";

export type SkillMatchDetail = {
  termId: string;
  label: string;
  must: boolean;
  weight: number;
  candidateLevel: number | null;
  matched: boolean;
  contribution: number;
};

export type SeniorityFit = "exact" | "close" | "below" | "unknown";
export type ExperienceFit = "meets" | "close" | "below" | "unknown";

export type MatchResult = {
  score: number;
  label: MatchLabel;

  // Skills
  skillScore: number; // 0-100 relativo a skills, antes de ponderación
  mustScore: number;
  niceScore: number;
  matchedCount: number;
  totalRequired: number;
  totalNice: number;
  details: SkillMatchDetail[];

  // Seniority
  seniorityScore: number; // 0-15
  seniorityFit: SeniorityFit;

  // Experience
  experienceScore: number; // 0-20
  experienceFit: ExperienceFit;
};

export type MatchLabel = "Muy alto" | "Alto" | "Medio" | "Bajo" | "Sin datos";

// ── Puntos máximos ────────────────────────────────────────────────────────

const MAX_SKILL_POINTS = 65;
const MAX_SENIORITY_POINTS = 15;
const MAX_EXPERIENCE_POINTS = 20;

const SENIORITY_MAP: Record<SeniorityLevel, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
};

// ── Helpers internos ──────────────────────────────────────────────────────

function computeSeniorityScore(
  jobSeniority?: SeniorityLevel | null,
  candidateSeniority?: SeniorityLevel | null
): { score: number; fit: SeniorityFit } {
  if (!jobSeniority || !candidateSeniority) {
    return { score: 0, fit: "unknown" };
  }

  const jobValue = SENIORITY_MAP[jobSeniority];
  const candidateValue = SENIORITY_MAP[candidateSeniority];
  const diff = candidateValue - jobValue;

  if (diff === 0) {
    return { score: MAX_SENIORITY_POINTS, fit: "exact" };
  }

  if (diff === -1) {
    return { score: 8, fit: "close" };
  }

  if (diff <= -2) {
    return { score: 0, fit: "below" };
  }

  return { score: 8, fit: "close" };
}

function computeExperienceScore(
  jobMinYears?: number | null,
  candidateYears?: number | null
): { score: number; fit: ExperienceFit } {
  if (jobMinYears == null || candidateYears == null) {
    return { score: 0, fit: "unknown" };
  }

  const diff = jobMinYears - candidateYears;

  if (diff <= 0) {
    return { score: MAX_EXPERIENCE_POINTS, fit: "meets" };
  }

  if (diff <= 1) {
    return { score: 14, fit: "close" };
  }

  if (diff <= 2) {
    return { score: 8, fit: "close" };
  }

  return { score: 0, fit: "below" };
}

// ── Firma de input ────────────────────────────────────────────────────────

export type ComputeMatchInput = {
  jobSkills: JobSkillInput[];
  candidateSkills: CandidateSkillInput[];
  jobSeniority?: SeniorityLevel | null;
  candidateSeniority?: SeniorityLevel | null;
  jobMinYearsExperience?: number | null;
  candidateYearsExperience?: number | null;
};

// ── Motor principal ───────────────────────────────────────────────────────

export function computeMatchScore(
  inputOrJobSkills: ComputeMatchInput | JobSkillInput[],
  candidateSkillsLegacy?: CandidateSkillInput[]
): MatchResult {
  // Soporte de firma legacy: computeMatchScore(jobSkills[], candidateSkills[])
  const input: ComputeMatchInput = Array.isArray(inputOrJobSkills)
    ? {
        jobSkills: inputOrJobSkills,
        candidateSkills: candidateSkillsLegacy ?? [],
      }
    : inputOrJobSkills;

  const {
    jobSkills,
    candidateSkills,
    jobSeniority,
    candidateSeniority,
    jobMinYearsExperience,
    candidateYearsExperience,
  } = input;

  const candMap = new Map<string, CandidateSkillInput>();
  for (const cs of candidateSkills) candMap.set(cs.termId, cs);

  const mustSkills = jobSkills.filter((s) => s.must);
  const niceSkills = jobSkills.filter((s) => !s.must);
  const details: SkillMatchDetail[] = [];

  let mustPoints = 0;
  let mustMax = 0;
  let nicePoints = 0;
  let niceMax = 0;
  let matchedCount = 0;

  for (const js of jobSkills) {
    const weight = js.weight ?? 5;
    const candidateSkill = candMap.get(js.termId);
    const matched = !!candidateSkill;

    // nivel 5 = 100%, nivel 3 = 84%, nivel 1 = 68%, sin nivel = 80%
    const levelMultiplier = matched
      ? candidateSkill.level
        ? 0.6 + (candidateSkill.level / 5) * 0.4
        : 0.8
      : 0;

    const contribution = weight * levelMultiplier;

    if (js.must) {
      mustMax += weight;
      mustPoints += contribution;
    } else {
      niceMax += weight;
      nicePoints += contribution;
    }

    if (matched) matchedCount++;

    details.push({
      termId: js.termId,
      label: js.label,
      must: js.must,
      weight,
      candidateLevel: candidateSkill?.level ?? null,
      matched,
      contribution: Math.round(contribution * 10) / 10,
    });
  }

  const mustPct = mustMax > 0 ? (mustPoints / mustMax) * 100 : 100;
  const nicePct = niceMax > 0 ? (nicePoints / niceMax) * 100 : 100;
  const hasMust = mustSkills.length > 0;
  const hasNice = niceSkills.length > 0;

  let rawSkillScore = 0;
  if (hasMust && hasNice) rawSkillScore = mustPct * 0.7 + nicePct * 0.3;
  else if (hasMust) rawSkillScore = mustPct;
  else if (hasNice) rawSkillScore = nicePct;

  rawSkillScore = Math.max(0, Math.min(100, rawSkillScore));

  const { score: seniorityScore, fit: seniorityFit } = computeSeniorityScore(
    jobSeniority,
    candidateSeniority
  );

  const { score: experienceScore, fit: experienceFit } = computeExperienceScore(
    jobMinYearsExperience,
    candidateYearsExperience
  );

  const hasSeniority = seniorityFit !== "unknown";
  const hasExperience = experienceFit !== "unknown";

  const skillPoints = (rawSkillScore / 100) * MAX_SKILL_POINTS;

  let totalScore = 0;

  if (hasSeniority && hasExperience) {
    totalScore = skillPoints + seniorityScore + experienceScore;
  } else if (hasSeniority) {
    totalScore = (skillPoints + seniorityScore) / 0.8;
  } else if (hasExperience) {
    totalScore = (skillPoints + experienceScore) / 0.85;
  } else if (jobSkills.length > 0) {
    totalScore = rawSkillScore;
  } else {
    totalScore = seniorityScore + experienceScore;
  }

  const score = Math.round(Math.max(0, Math.min(100, totalScore)));

  return {
    score,
    label: scoreToLabel(score),
    skillScore: Math.round(rawSkillScore),
    mustScore: Math.round(mustPct),
    niceScore: Math.round(nicePct),
    matchedCount,
    totalRequired: mustSkills.length,
    totalNice: niceSkills.length,
    details,
    seniorityScore,
    seniorityFit,
    experienceScore,
    experienceFit,
  };
}

// ── Helpers de UI ─────────────────────────────────────────────────────────

export function scoreToLabel(score: number): MatchLabel {
  if (score >= 85) return "Muy alto";
  if (score >= 65) return "Alto";
  if (score >= 40) return "Medio";
  if (score > 0) return "Bajo";
  return "Sin datos";
}

export function scoreToColor(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-emerald-400";
  if (score >= 40) return "bg-yellow-400";
  if (score > 0) return "bg-orange-400";
  return "bg-zinc-300";
}

export function scoreToTextColor(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 65) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-yellow-700 dark:text-yellow-400";
  if (score > 0) return "text-orange-600 dark:text-orange-400";
  return "text-zinc-400";
}

// ── Plan gate ─────────────────────────────────────────────────────────────

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