import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  companyId: vi.fn(),
  company: vi.fn(),
  job: vi.fn(),
  applications: vi.fn(),
  application: vi.fn(),
  applicationUpdate: vi.fn(),
  eventCreate: vi.fn(),
  invites: vi.fn(),
  attempts: vi.fn(),
  intent: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: mocks.companyId }));
vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    company: { findUnique: mocks.company },
    job: { findFirst: mocks.job },
    application: {
      findMany: mocks.applications,
      findFirst: mocks.application,
      updateMany: mocks.applicationUpdate,
    },
    applicationEvent: { create: mocks.eventCreate },
    assessmentInvite: { findMany: mocks.invites },
    assessmentAttempt: { findMany: mocks.attempts },
  },
}));
vi.mock("@/lib/hiring-process/application-intents", () => ({
  executeApplicationIntent: mocks.intent,
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
  redirect: () => { throw new Error("REDIRECT"); },
}));

import JobPipelinePage from "@/app/dashboard/jobs/[id]/page";

type ElementNode = { props?: Record<string, unknown> };

function findBoard(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const props = (node as ElementNode).props;
  if (!props) return null;
  if ("applications" in props && "moveAction" in props) return props;
  for (const child of [props.children].flat()) {
    const found = findBoard(child);
    if (found) return found;
  }
  return null;
}

const assignments = [
  { templateId: "own-id", template: { title: "Own title", companyId: "company-a", isGlobal: false } },
  { templateId: "global-id", template: { title: "Global title", companyId: null, isGlobal: true } },
  { templateId: "foreign-secret-id", template: { title: "Foreign secret title", companyId: "company-b", isGlobal: false } },
];

const historicalAttempts = [
  { id: "own-attempt", templateId: "own-id", applicationId: "app-a", status: "COMPLETED", totalScore: 81, passed: true },
  { id: "global-attempt", templateId: "global-id", applicationId: "app-a", status: "COMPLETED", totalScore: 72, passed: true },
  { id: "foreign-secret-attempt", templateId: "foreign-secret-id", applicationId: "app-a", status: "COMPLETED", totalScore: 97, passed: false },
];

const app = (id: string, jobId: string, companyId: string) => ({
  id, jobId, companyId, stateVersion: 1, stage: "APPLIED", disposition: "ACTIVE",
  status: "SUBMITTED", recruiterInterest: "REVIEW",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  candidate: {
    id: "candidate-a", name: "Candidate", email: "candidate@example.invalid",
    candidateSkills: [], seniority: null, yearsExperience: null,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  mocks.session.mockResolvedValue({ user: { id: "recruiter-a", role: "RECRUITER" } });
  mocks.companyId.mockResolvedValue("company-a");
  mocks.company.mockResolvedValue({ billingPlan: "PRO", name: "Company A" });
  mocks.job.mockImplementation(async ({ where, select }) => {
    if (where.id !== "job-a" || where.companyId !== "company-a") return null;
    const visibility = select.assessments.where.template;
    return {
      id: "job-a", slug: null, title: "Job A", location: null,
      seniority: null, minYearsExperience: null, company: { name: "Company A" },
      requiredSkills: [],
      assessments: assignments.filter(({ template }) =>
        visibility.OR?.some((rule: { isGlobal?: boolean; companyId?: string }) =>
          rule.isGlobal === true ? template.isGlobal : rule.companyId === template.companyId,
        ) || Object.keys(visibility).length === 0,
      ),
    };
  });
  mocks.applications.mockResolvedValue([app("app-a", "job-a", "company-a")]);
  mocks.application.mockImplementation(async ({ where }) =>
    [app("app-a", "job-a", "company-a"), app("app-other-job", "job-b", "company-a"),
      app("app-other-company", "job-c", "company-b")]
      .find((row) => row.id === where.id && row.jobId === where.jobId &&
        row.companyId === where.job.companyId) ?? null,
  );
  mocks.invites.mockImplementation(async ({ where }) =>
    assignments.filter(({ templateId }) => where.templateId.in.includes(templateId))
      .map(({ templateId }) => ({ applicationId: "app-a", templateId,
        status: "SENT", expiresAt: new Date("2099-01-01T00:00:00Z") })),
  );
  mocks.attempts.mockImplementation(async ({ where }) =>
    historicalAttempts.filter(({ applicationId, templateId }) =>
      where.applicationId.in.includes(applicationId) && where.templateId.in.includes(templateId),
    ),
  );
  mocks.intent.mockResolvedValue({ state: { stage: "REVIEW", disposition: "ACTIVE" }, legacy: { stateVersion: 2, status: "REVIEWING", recruiterInterest: "REVIEW" } });
});

async function board() {
  const props = findBoard(await JobPipelinePage({ params: { id: "job-a" } }));
  expect(props).not.toBeNull();
  return props!;
}

function moveForm(appId: string) {
  const form = new FormData();
  form.set("appId", appId);
  form.set("newStatus", "MAYBE");
  form.set("expectedVersion", "1");
  form.set("commandId", `command-${appId}`);
  return form;
}

describe("ATS Kanban tenant and job boundaries", () => {
  it("requires the explicit START_REVIEW version even for a legacy command", async () => {
    const action = (await board()).moveAction as (form: FormData) => Promise<{ ok: boolean }>;
    const form = moveForm("app-a");
    form.set("intent", "START_REVIEW");
    form.set("newStatus", "REVIEW");
    form.delete("expectedVersion");
    expect((await action(form)).ok).toBe(false);
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("dispatches an explicit START_REVIEW without losing the job scope", async () => {
    const action = (await board()).moveAction as (form: FormData) => Promise<{ ok: boolean }>;
    const form = moveForm("app-a");
    form.set("intent", "START_REVIEW");
    form.set("newStatus", "REVIEW");
    expect((await action(form)).ok).toBe(true);
    expect(mocks.intent).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: "app-a", command: { intent: "START_REVIEW", expectedVersion: 1, commandId: "command-app-a" },
    }));
  });
  it("filters historical foreign templates in the database query and client payload", async () => {
    const props = await board();
    expect(mocks.job.mock.calls[0][0].select.assessments.where.template).toEqual({
      OR: [{ isGlobal: true }, { companyId: "company-a" }],
    });
    expect(mocks.invites.mock.calls[0][0].where.templateId.in).toEqual(["own-id", "global-id"]);
    expect(mocks.attempts.mock.calls[0][0].where.templateId.in).toEqual(["own-id", "global-id"]);
    const payload = JSON.stringify(props.applications);
    expect(payload).toContain("Own title");
    expect(payload).toContain("Global title");
    expect(payload).toContain("own-attempt");
    expect(payload).toContain("global-attempt");
    expect(payload).toContain('"score":81');
    expect(payload).toContain('"score":72');
    expect(payload).not.toContain("foreign-secret-id");
    expect(payload).not.toContain("Foreign secret title");
    expect(payload).not.toContain("foreign-secret-attempt");
    expect(payload).not.toContain('"score":97');
  });

  it("rejects a role without template access before loading the job", async () => {
    mocks.session.mockResolvedValue({ user: { id: "candidate", role: "CANDIDATE" } });
    await expect(JobPipelinePage({ params: { id: "job-a" } })).rejects.toThrow("NOT_FOUND");
    expect(mocks.job).not.toHaveBeenCalled();
  });

  it("updates only an application of the displayed job and approved company", async () => {
    const action = (await board()).moveAction as (form: FormData) => Promise<{ ok: boolean }>;
    expect((await action(moveForm("app-a"))).ok).toBe(true);
    expect(mocks.application.mock.calls[0][0].where).toEqual({
      id: "app-a", jobId: "job-a", job: { companyId: "company-a" },
    });
    expect(mocks.intent).toHaveBeenCalledOnce();
  });

  it.each(["app-other-job", "app-other-company", "unknown", "app-a:tampered"])(
    "does not write or create events for %s",
    async (appId) => {
      const action = (await board()).moveAction as (form: FormData) => Promise<{ ok: boolean }>;
      expect((await action(moveForm(appId))).ok).toBe(false);
      expect(mocks.intent).not.toHaveBeenCalled();
      expect(mocks.applicationUpdate).not.toHaveBeenCalled();
      expect(mocks.eventCreate).not.toHaveBeenCalled();
    },
  );
});
