import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), companyId: vi.fn(), company: vi.fn(), job: vi.fn(), jobs: vi.fn(), count: vi.fn(), group: vi.fn(), recruiter: vi.fn(), apps: vi.fn(), app: vi.fn(), candidate: vi.fn(), cache: vi.fn(), save: vi.fn(), generate: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: mocks.companyId }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/server/prisma", () => ({ prisma: {
  company: { findUnique: mocks.company }, job: { findFirst: mocks.job, findMany: mocks.jobs, count: mocks.count },
  application: { findMany: mocks.apps, findFirst: mocks.app, count: mocks.count, groupBy: mocks.group }, user: { findUnique: mocks.candidate, findFirst: mocks.candidate },
  applicationEvent: { groupBy: mocks.group },
  recruiterProfile: { findUnique: mocks.recruiter }, assessmentAttempt: { count: mocks.count }, assessmentInvite: { count: mocks.count },
  matchExplanationCache: { findFirst: mocks.cache, create: mocks.save, update: mocks.save },
} }));
vi.mock("@/lib/ai/matchExplanation", () => ({ generateMatchExplanation: mocks.generate, buildMatchExplanationFingerprint: () => "fingerprint", MATCH_EXPLANATION_VERSION: "test" }));
import KanbanPage from "@/app/dashboard/jobs/[id]/page";
import ListPage from "@/app/dashboard/jobs/[id]/applications/page";
import ProfilePage from "@/app/dashboard/candidates/[id]/page";
import OverviewPage from "@/app/dashboard/overview/page";
import MatchScorePopover from "@/components/dashboard/MatchScorePopover";
import { GET, POST } from "@/app/api/ai/match-explanation/route";
import { computeRecruiterMatch, recruiterMatchCandidateSelect, recruiterMatchJobSelect } from "@/lib/ai/recruiter-match";
import type { NextRequest } from "next/server";

const now = new Date("2026-10-29T12:00:00Z");
const term = { id: "java", label: "Java", aliases: ["JVM"] };
const job = { id: "job-a", title: "Backend Java AWS", slug: null, status: "OPEN", location: "Remote", seniority: null, minYearsExperience: null,
  createdAt: now, updatedAt: now, company: { name: "Company A" }, skills: [], assessments: [],
  requiredSkills: [{ term, must: true, weight: 4 }, { term: { id: "sql", label: "SQL", aliases: [] }, must: true, weight: 3 }],
};
const candidate = { id: "candidate-a", name: "Synthetic Candidate", email: "candidate@example.invalid", firstName: "Synthetic", lastName: "Candidate", resumeUrl: null, phone: null, location: null, certifications: [], seniority: null, yearsExperience: null,
  skills: [], candidateSkills: [{ term, level: 3 }], candidateBadges: [], candidateLanguages: [], experiences: [], aiProfile: { profileType: "ENGINEERING", tags: ["backend", "cloud"] },
};
const cohort = Array.from({ length: 12 }, (_, i) => ({
  id: `app-${String(i).padStart(2, "0")}`,
  jobId: "job-a",
  createdAt: new Date(now.getTime() + i * 1000),
  updatedAt: now,
  submittedAt: new Date(now.getTime() + i * 1000),
  status: "SUBMITTED",
  recruiterInterest: "REVIEW",
  stage: "APPLIED",
  disposition: "ACTIVE",
  stateVersion: 1,
  candidate: {
    ...candidate,
    id: `candidate-${i}`,
    name: `Synthetic Candidate ${i}`,
  },
}));
function nodes(value: unknown): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function popovers(tree: unknown) { return nodes(tree).filter((node) => node.type === MatchScorePopover).map((node) => node.props); }
function board(tree: unknown) { return nodes(tree).find((node) => "moveAction" in node.props)!.props; }
function rows(tree: unknown) { return nodes(tree).filter((node) => node.type === "tr" && node.key).map((node) => node.key); }
async function pages(searchParams: Record<string, string> = {}) {
  return Promise.all([KanbanPage({ params: { id: "job-a" } }), ListPage({ params: { id: "job-a" }, searchParams: { interest: "ALL", ...searchParams } })]);
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("React", React);
  vi.stubEnv("CANONICAL_HIRING_PROCESS_RECRUITER_READS_ENABLED", "true");
  mocks.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER", name: "Recruiter", companyId: "company-a" } });
  mocks.companyId.mockResolvedValue("company-a");
  mocks.company.mockResolvedValue({ billingPlan: "PRO", name: "Company A" });
  mocks.job.mockImplementation(async ({ where }) => where.id === "job-a" && where.companyId === "company-a" ? job : null);
  mocks.apps.mockResolvedValue(cohort);
  mocks.app.mockResolvedValue({ id: "app-00", job: { companyId: "company-a", company: { billingPlan: "PRO" } } });
  mocks.candidate.mockResolvedValue(candidate);
  mocks.cache.mockResolvedValue(null);
  mocks.count.mockResolvedValue(0);
  mocks.group.mockResolvedValue([]);
  mocks.recruiter.mockResolvedValue({ status: "APPROVED", phone: "synthetic" });
  mocks.generate.mockResolvedValue({ summary: "Synthetic", strengths: [], gaps: [], interviewFocus: [], recommendation: "REVIEW", generatedAt: now.toISOString() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("recruiter match surface consistency and plan boundaries", () => {
  it.each(["FREE", "STARTER", "PRO", "BUSINESS"])("limits Overview averages to visible %s scores", async (plan) => {
    mocks.company.mockResolvedValue({ billingPlan: plan, name: "Company A" });
    mocks.apps.mockResolvedValue([]);
    mocks.jobs.mockResolvedValue([{ ...job, applications: cohort, _count: { applications: cohort.length } }]);
    const original = await OverviewPage();
    const serialize = (tree: unknown) => JSON.stringify(tree, (key, value) => key === "type" || key === "_owner" ? undefined : value);
    if (plan === "FREE") {
      expect(serialize(original)).not.toContain("Promedio global:");
      expect(serialize(original)).toContain("AI Match bloqueado");
    } else {
      expect(serialize(original)).toContain("promedio visible");
      expect(serialize(original)).toContain(`${computeRecruiterMatch(job, candidate, now).finalScore}%`);
    }
    if (plan === "STARTER") {
      mocks.jobs.mockResolvedValue([{ ...job, applications: cohort.map((app) => app.id === "app-11" ? { ...app, candidate: { ...app.candidate, candidateSkills: [{ term, level: 5 }] } } : app), _count: { applications: cohort.length } }]);
      expect(serialize(await OverviewPage())).toEqual(serialize(original));
    }
    expect(mocks.jobs.mock.calls[0][0].select.applications.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(mocks.jobs.mock.calls[0][0].select.applications.take).toBeGreaterThanOrEqual(10);
  });
  it("uses the same final score and normalized selections on the actual two pages", async () => {
    const [kanban, list] = await pages();
    const cards = board(kanban).applications as Array<{ _score: number; candidate: { id: string } }>;
    const detail = popovers(list).find((props) => props.candidateId === "candidate-0")!;
    const expected = computeRecruiterMatch(job, candidate, now);
    expect(detail.score).toBe(expected.finalScore);
    expect(cards.find((card) => card.candidate.id === "candidate-0")!._score).toBe(detail.score);
    expect(detail.adjustments).toMatchObject({ baseScore: 48, finalScore: expected.finalScore, profileAdjustment: 5 });
    expect((detail.matchResult as { score: number }).score).toBe(48);
    for (const [query] of mocks.job.mock.calls) {
      expect(query.where).toEqual({ id: "job-a", companyId: "company-a" });
      expect(query.select.requiredSkills).toEqual(recruiterMatchJobSelect.requiredSkills);
    }
    for (const [query] of mocks.apps.mock.calls) {
      expect(query.where).toEqual({ jobId: "job-a", job: { companyId: "company-a" } });
      expect(query.include.candidate.select.candidateSkills).toEqual(recruiterMatchCandidateSelect(now).candidateSkills);
      expect(query.include.candidate.select.candidateBadges.select).toEqual(recruiterMatchCandidateSelect(now).candidateBadges.select);
    }
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([["FREE", 0], ["STARTER", 10], ["PRO", 12], ["BUSINESS", 12]])("keeps %s scores gated before serialization", async (plan, count) => {
    mocks.company.mockResolvedValue({ billingPlan: plan, name: "Company A" });
    const [kanban, list] = await pages();
    const cards = board(kanban).applications as Array<{ _score: number | null; _locked: boolean }>;
    expect(cards.filter((card) => !card._locked)).toHaveLength(count as number);
    expect(cards.filter((card) => card._locked).every((card) => card._score === null)).toBe(true);
    expect(popovers(list)).toHaveLength(count as number);
    if (plan === "FREE") {
      const payload = JSON.stringify(list, (key, value) => key === "type" || key === "_owner" ? undefined : value);
      expect(payload).not.toContain('"adjustments":');
      expect(payload).not.toContain('"matchResult":');
      expect(payload).not.toContain(`${computeRecruiterMatch(job, candidate, now).finalScore}%`);
    }
  });
  it("does not unlock filtered candidates and does not sort by private scores", async () => {
    mocks.company.mockResolvedValue({ billingPlan: "STARTER", name: "Company A" });
    const original = await ListPage({ params: { id: "job-a" }, searchParams: { interest: "ALL", sort: "match" } });
    mocks.apps.mockResolvedValue([...cohort].reverse().map((app) => app.id === "app-11" ? { ...app, candidate: { ...app.candidate, candidateSkills: [{ term, level: 5 }] } } : app));
    const changed = await ListPage({ params: { id: "job-a" }, searchParams: { interest: "ALL", sort: "match" } });
    expect(rows(changed)).toEqual(rows(original));
    expect(popovers(changed).map((props) => props.candidateId).sort()).toEqual(popovers(original).map((props) => props.candidateId).sort());
    const [, filtered] = await pages({ q: "Synthetic Candidate 11", sort: "name" });
    expect(popovers(filtered)).toHaveLength(0);
    expect(rows(filtered)).toContain("app-11");
    const [, matchFiltered] = await pages({ q: "Synthetic Candidate 11", match: "HIGH" });
    expect(rows(matchFiltered)).not.toContain("app-11");
  });
  it("denies a job from another tenant before reading applications", async () => {
    mocks.job.mockResolvedValue(null);
    await expect(KanbanPage({ params: { id: "job-b" } })).rejects.toThrow("NOT_FOUND");
    await expect(ListPage({ params: { id: "job-b" } })).rejects.toThrow("NOT_FOUND");
    expect(mocks.apps).not.toHaveBeenCalled();
  });
  it.each([["FREE", "app-00", true], ["STARTER", "app-11", true], ["STARTER", "app-00", false], ["PRO", "app-11", false], ["BUSINESS", "app-11", false]])(
    "keeps the profile score gated for %s/%s", async (plan, applicationId, locked) => {
      mocks.company.mockResolvedValue({ billingPlan: plan, name: "Company A" });
      mocks.job.mockResolvedValue({ ...job, companyId: "company-a" });
      mocks.candidate.mockImplementation(async ({ where }) => where.email ? { id: "recruiter-a", name: "Recruiter", role: "RECRUITER", recruiterProfile: { companyId: "company-a", status: "APPROVED" } }
        : { ...candidate, role: "CANDIDATE", education: [] });
      mocks.app.mockResolvedValue({ ...cohort.find((app) => app.id === applicationId),
        submittedAt: now, reviewingAt: null, interviewAt: null, offerAt: null, hiredAt: null, rejectedAt: null, lastViewedAt: null,
        job: { title: job.title, companyConfidential: false, company: { name: "Company A" } },
      });
      mocks.session.mockResolvedValue({ user: { email: "recruiter@example.invalid", role: "RECRUITER", id: "recruiter-a" } });
      const tree = await ProfilePage({ params: { id: "candidate-0" }, searchParams: { applicationId: applicationId as string, jobId: "job-a" } });
      expect(tree.props.matchLocked).toBe(locked);
      expect(tree.props.matchScore).toBe(locked ? null : computeRecruiterMatch(job, candidate, now).finalScore);
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );
});

describe("profile access with jobId only", () => {
  it.each([
    ["FREE", "app-00", true],
    ["STARTER", "app-00", false],
    ["STARTER", "app-11", true],
    ["PRO", "app-11", false],
    ["BUSINESS", "app-11", false],
  ] as const)(
    "resolves authorized application for %s/%s",
    async (plan, applicationId, locked) => {
      mocks.session.mockResolvedValue({
        user: {
          id: "recruiter-a",
          email: "recruiter@example.invalid",
          role: "RECRUITER",
        },
      });
      mocks.company.mockResolvedValue({
        billingPlan: plan,
        name: "Company A",
      });

      mocks.job.mockResolvedValue({
        ...job,
        companyId: "company-a",
      });

      mocks.candidate.mockImplementation(async ({ where }) =>
        where.email
          ? {
              id: "recruiter-a",
              name: "Recruiter",
              role: "RECRUITER",
              recruiterProfile: {
                companyId: "company-a",
                status: "APPROVED",
              },
            }
          : { ...candidate, role: "CANDIDATE", education: [] }
      );

      mocks.app.mockResolvedValue({
        ...cohort.find((app) => app.id === applicationId),
        submittedAt: now,
        reviewingAt: null,
        interviewAt: null,
        offerAt: null,
        hiredAt: null,
        rejectedAt: null,
        lastViewedAt: null,
        job: {
          title: job.title,
          companyConfidential: false,
          company: { name: "Company A" },
        },
      });

      const tree = await ProfilePage({
        params: { id: "candidate-0" },
        searchParams: { jobId: "job-a" },
      });

      expect(tree.props.applicationId).toBe(applicationId);
      expect(tree.props.matchLocked).toBe(locked);
      expect(tree.props.matchScore).toBe(
        locked ? null : computeRecruiterMatch(job, candidate, now).finalScore
      );

      expect(mocks.app.mock.calls[0][0].where).toMatchObject({
        jobId: "job-a",
        candidateId: "candidate-0",
        job: { companyId: "company-a" },
      });
    }
  );
});
const getRequest = () => new Request("http://localhost/api/ai/match-explanation?candidateId=candidate-0&jobId=job-a&force=1") as NextRequest;
const postRequest = () => new Request("http://localhost/api/ai/match-explanation", { method: "POST", body: JSON.stringify({ candidateId: "candidate-0", jobId: "job-a" }) }) as NextRequest;
describe("match explanation API entitlement", () => {
  it.each(["FREE", "STARTER"])("denies %s locked rows before cache, candidate data or AI", async (plan) => {
    mocks.app.mockResolvedValue({ id: "app-11", job: { companyId: "company-a", company: { billingPlan: plan } } });
    for (const response of [await GET(getRequest()), await GET(new Request("http://localhost/api/ai/match-explanation?candidateId=candidate-0&jobId=job-a") as NextRequest), await POST(postRequest())]) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).not.toHaveProperty("score");
    }
    expect(mocks.cache).not.toHaveBeenCalled();
    expect(mocks.candidate).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("keeps eligible API explanations on the shared final score", async () => {
    expect((await GET(getRequest())).status).toBe(200);
    expect(mocks.generate.mock.calls[0][0].match.score).toBe(computeRecruiterMatch(job, candidate, now).finalScore);
    expect(mocks.generate.mock.calls[0][0].match.adjustments.baseScore).toBe(48);
  });
  it.each([
    ["FREE", 403, true],
    ["STARTER", 200, false],
    ["PRO", 200, false],
    ["BUSINESS", 200, false],
  ] as const)(
    "keeps ADMIN profile and API aligned for %s",
    async (plan, expectedStatus, locked) => {
      mocks.session.mockResolvedValue({
        user: {
          id: "admin",
          email: "admin@example.invalid",
          role: "ADMIN",
        },
      });

      mocks.candidate.mockImplementation(async ({ where }) =>
        where.email
          ? {
              id: "admin",
              role: "ADMIN",
              name: "Admin",
              recruiterProfile: null,
            }
          : { ...candidate, role: "CANDIDATE", education: [] }
      );

      mocks.company.mockResolvedValue({
        billingPlan: plan,
        name: "Company A",
      });

      mocks.job.mockResolvedValue({
        ...job,
        companyId: "company-a",
      });

      mocks.app.mockResolvedValue({
        ...cohort[0],
        submittedAt: now,
        reviewingAt: null,
        interviewAt: null,
        offerAt: null,
        hiredAt: null,
        rejectedAt: null,
        lastViewedAt: null,
        job: {
          title: job.title,
          companyId: "company-a",
          companyConfidential: false,
          company: {
            name: "Company A",
            billingPlan: plan,
          },
        },
      });

      const profile = await ProfilePage({
        params: { id: "candidate-0" },
        searchParams: {
          jobId: "job-a",
          applicationId: "app-00",
        },
      });

      expect(profile.props.matchLocked).toBe(locked);

      const response = await GET(getRequest());
      expect(response.status).toBe(expectedStatus);

      if (locked) {
        expect(profile.props.matchScore).toBeNull();
        expect(mocks.generate).not.toHaveBeenCalled();
      } else {
        const expectedScore = computeRecruiterMatch(
          job,
          candidate,
          now
        ).finalScore;

        expect(profile.props.matchScore).toBe(expectedScore);
        expect(mocks.generate.mock.calls[0][0].match.score)
          .toBe(expectedScore);
      }
    }
  );
  it("preserves explicit admin access to authorized plan scores", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } });
    mocks.job.mockResolvedValue(job);
    expect((await GET(getRequest())).status).toBe(200);
    expect(mocks.app.mock.calls[0][0].where).toEqual({ candidateId: "candidate-0", jobId: "job-a" });
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it("rejects unauthenticated, candidate and cross-tenant requests", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(getRequest())).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { role: "CANDIDATE" } });
    expect((await POST(postRequest())).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { role: "RECRUITER" } });
    mocks.app.mockResolvedValue(null);
    expect((await GET(getRequest())).status).toBe(404);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
