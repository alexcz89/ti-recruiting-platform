import { describe, expect, it } from "vitest";
import { computeRecruiterMatch, getRecruiterMatchAccessIds } from "@/lib/ai/recruiter-match";
import { computeMatchScore, type BillingPlan } from "@/lib/ai/matchScore";

const now = new Date("2026-10-29T12:00:00Z");
const term = { id: "java", label: "Java", aliases: ["JVM"] };
const job = { title: "Backend Java AWS", requiredSkills: [
  { term, must: true, weight: 4 }, { term: { id: "sql", label: "SQL" }, must: true, weight: 3 },
] };
const candidate = { candidateSkills: [{ term, level: 3 }], aiProfile: { profileType: "ENGINEERING", tags: ["backend", "cloud"] } };
describe("shared recruiter match", () => {
  it("preserves the engine and exposes each adjustment separately from skill matches", () => {
    const result = computeRecruiterMatch(job, candidate, now);
    expect(result.baseScore).toBe(48);
    expect(result.matchResult.score).toBe(result.baseScore);
    expect(result.profileAdjustment).toBe(5);
    expect(result.tagBoost).toBe(8);
    expect(result.finalScore).toBe(61);
    expect(result.finalScore).toBe(result.baseScore + result.profileAdjustment + result.tagAdjustment);
    expect(result.finalScore).toBeGreaterThan(result.baseScore);
    expect(result.matchResult.matchedCount).toBe(1);
    expect(computeMatchScore({ jobSkills: [{ termId: "java", label: "Java", must: true, weight: 4 }, { termId: "sql", label: "SQL", must: true, weight: 3 }], candidateSkills: [{ termId: "java", label: "Java", level: 3 }] }).score).toBe(result.baseScore);
  });
  it("normalizes aliases and uses legacy skills only as the existing fallback", () => {
    expect(computeRecruiterMatch({ skills: ["JVM"] }, { candidateSkills: [{ term, level: 5 }] }, now).baseScore).toBe(100);
    expect(computeRecruiterMatch({ skills: ["jvm"] }, { skills: [" JVM ", "jvm"] }, now).matchResult.matchedCount).toBe(1);
  });
  it("uses only public current badges, including skills absent from the profile", () => {
    const badge = { term, level: 3, earnedAt: new Date("2026-10-28"), isPublic: true };
    const current = computeRecruiterMatch(job, { candidateBadges: [badge] }, now);
    expect(current.matchResult.matchedCount).toBe(1);
    for (const patch of [{ isPublic: false }, { earnedAt: new Date("2024-01-01") }, { earnedAt: "invalid" }]) {
      expect(computeRecruiterMatch(job, { candidateBadges: [{ ...badge, ...patch }] }, now).baseScore).toBe(0);
    }
  });
  it("does not depend on database ordering or alias order", () => {
    const skills = [{ term: { ...term, aliases: ["JVM", "Java SE"] }, level: 1 }, { term, level: 5 }];
    expect(computeRecruiterMatch(job, { candidateSkills: skills }, now))
      .toEqual(computeRecruiterMatch({ ...job, requiredSkills: [...job.requiredSkills].reverse() }, { candidateSkills: [...skills].reverse() }, now));
  });
  it.each([["ENGINEERING", 5], ["HYBRID", -5], ["RECRUITING", -15], ["BUSINESS", -15], ["DATA", 0], [null, 0]] as const)("retains profile weight %s", (profileType, weight) => {
    const result = computeRecruiterMatch(job, { ...candidate, aiProfile: { profileType, tags: [] } }, now);
    expect(result.profileAdjustment).toBe(weight);
    expect(result.tagBoost).toBe(0);
  });
  it("supports absent data and clamps the final score with explainable applied deltas", () => {
    expect(computeRecruiterMatch({}, {}, now).finalScore).toBe(0);
    const full = computeRecruiterMatch({ ...job, requiredSkills: [job.requiredSkills[0]] }, { candidateSkills: [{ term, level: 5 }], aiProfile: candidate.aiProfile }, now);
    expect(full.finalScore).toBe(100);
    expect(full.baseScore + full.profileAdjustment + full.tagAdjustment).toBe(100);
    expect(computeRecruiterMatch(job, { aiProfile: { profileType: "BUSINESS", tags: [] } }, now).finalScore).toBe(0);
  });
  it.each([["FREE", 0], ["STARTER", 10], ["PRO", 12], ["BUSINESS", 12]] as const)("keeps %s quota deterministic", (plan: BillingPlan, count) => {
    const cohort = Array.from({ length: 12 }, (_, i) => ({ id: `app-${String(i).padStart(2, "0")}`, createdAt: now }));
    const ids = getRecruiterMatchAccessIds(cohort, plan);
    expect(ids.size).toBe(count);
    expect([...ids]).toEqual([...getRecruiterMatchAccessIds([...cohort].reverse(), plan)]);
    if (plan === "STARTER") {
      expect(ids.has("app-09")).toBe(true);
      expect(ids.has("app-10")).toBe(false);
      // Presentation filters cannot change membership in this full-cohort set.
      expect(cohort.filter((row) => row.id === "app-10").map((row) => ids.has(row.id))).toEqual([false]);
    }
  });
});
