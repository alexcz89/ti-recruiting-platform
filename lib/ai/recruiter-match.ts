import type { Prisma } from "@prisma/client";
import { badgeValidityCutoff, isBadgeCurrent } from "@/lib/badges";
import { buildCandidateSkillInputs, buildJobSkillInputs, computeMatchScore, getMatchScoreLimit, hasMatchSignals, normalizeSkillKey, type BillingPlan, type SeniorityLevel } from "./matchScore";
import { computeTagBoost } from "./tagBoost";

export const recruiterMatchJobSelect = {
  title: true, skills: true, seniority: true, minYearsExperience: true,
  requiredSkills: { select: { must: true, weight: true, term: { select: { id: true, label: true, aliases: true } } } },
} as const satisfies Prisma.JobSelect;

export function recruiterMatchCandidateSelect(now: Date) {
  return {
    seniority: true, yearsExperience: true,
    aiProfile: { select: { tags: true, profileType: true } },
    candidateSkills: { select: { level: true, term: { select: { id: true, label: true, aliases: true } } } },
    candidateBadges: {
      where: { isPublic: true, earnedAt: { gte: badgeValidityCutoff(now) } },
      orderBy: [{ level: "desc" }, { earnedAt: "desc" }, { id: "asc" }],
      select: { level: true, slug: true, earnedAt: true, isPublic: true, term: { select: { id: true, label: true, aliases: true } } },
    },
  } as const satisfies Prisma.UserSelect;
}

type Job = {
  title?: string | null; skills?: string[] | null; seniority?: string | null; minYearsExperience?: number | null;
  requiredSkills?: Parameters<typeof buildJobSkillInputs>[0];
};
type Candidate = {
  skills?: string[] | null; seniority?: string | null; yearsExperience?: number | null;
  candidateSkills?: Parameters<typeof buildCandidateSkillInputs>[0];
  candidateBadges?: Array<NonNullable<Parameters<typeof buildCandidateSkillInputs>[2]>[number] & { earnedAt: Date | string; isPublic: boolean }>;
  aiProfile?: { tags?: string[] | null; profileType?: string | null } | null;
};

function seniority(value?: string | null): SeniorityLevel | null {
  const normalized = value?.toLowerCase();
  return normalized === "junior" || normalized === "mid" || normalized === "senior" ? normalized : null;
}
const clamp = (score: number) => Math.max(0, Math.min(100, score));
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function termKey(input: { term?: { id?: string | null; label?: string | null; aliases?: string[] | null } | null }) {
  return JSON.stringify([input.term?.id ?? "", normalizeSkillKey(input.term?.label),
    [...(input.term?.aliases ?? [])].map(normalizeSkillKey).sort(compare)]);
}
function stableSkills<T extends { termId?: string | null; label: string; aliases?: string[] | null; level?: number | null }>(skills: T[]): T[] {
  return skills.map((skill) => ({ ...skill, aliases: [...(skill.aliases ?? [])].sort(compare) }))
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || compare(`${a.termId}:${normalizeSkillKey(a.label)}:${a.aliases.join(",")}`, `${b.termId}:${normalizeSkillKey(b.label)}:${b.aliases.join(",")}`));
}

export function buildRecruiterMatchJob(job: Job) {
  const jobSkills = stableSkills(buildJobSkillInputs(job.requiredSkills, job.skills));
  const jobSeniority = seniority(job.seniority);
  return { jobSkills, jobSeniority, hasMatchSignals: hasMatchSignals({ jobSkills, jobSeniority, jobMinYearsExperience: job.minYearsExperience }) };
}

/** Preserves the list's existing adjustment order and weights. No persistence or model calls. */
export function computeRecruiterMatch(job: Job, candidate: Candidate, now: Date = new Date()) {
  const context = buildRecruiterMatchJob(job);
  const declared = [...(candidate.candidateSkills ?? [])].sort((a, b) =>
    (b.level ?? 0) - (a.level ?? 0) || compare(termKey(a), termKey(b)));
  const badges = (candidate.candidateBadges ?? []).filter((badge) => badge.isPublic && isBadgeCurrent(badge.earnedAt, now))
    .sort((a, b) => b.level - a.level || compare(termKey(a), termKey(b)));
  const candidateSkills = stableSkills(buildCandidateSkillInputs(declared, candidate.skills, badges));
  const matchResult = computeMatchScore({ jobSkills: context.jobSkills, candidateSkills,
    jobSeniority: context.jobSeniority, candidateSeniority: seniority(candidate.seniority),
    jobMinYearsExperience: job.minYearsExperience ?? null, candidateYearsExperience: candidate.yearsExperience ?? null });
  const baseScore = matchResult.score;
  const profile = String(candidate.aiProfile?.profileType ?? "").toUpperCase();
  const profileWeight = context.jobSkills.length === 0 ? 0
    : profile === "RECRUITING" || profile === "BUSINESS" ? -15 : profile === "HYBRID" ? -5 : profile === "ENGINEERING" ? 5 : 0;
  const profileAdjustedScore = clamp(baseScore + profileWeight);
  const tagBoost = computeTagBoost({ candidateTags: candidate.aiProfile?.tags ?? [], jobTitle: job.title ?? "", jobSkills: context.jobSkills.map((skill) => skill.label) });
  const finalScore = clamp(profileAdjustedScore + tagBoost);
  return { matchResult, baseScore, profileAdjustment: profileAdjustedScore - baseScore, tagBoost,
    tagAdjustment: finalScore - profileAdjustedScore, profileAdjustedScore, finalScore, candidateSkills };
}
export type RecruiterMatch = ReturnType<typeof computeRecruiterMatch>;
export type MatchAdjustments = Pick<RecruiterMatch, "baseScore" | "profileAdjustment" | "tagAdjustment" | "finalScore">;

/** Earliest applications first, with an ID tie-breaker. Always pass the complete authorized job cohort. */
export function getRecruiterMatchAccessIds(applications: readonly { id: string; createdAt: Date | string }[], plan: BillingPlan): Set<string> {
  const ordered = [...applications].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || compare(a.id, b.id));
  return new Set(ordered.slice(0, getMatchScoreLimit(plan)).map((application) => application.id));
}
