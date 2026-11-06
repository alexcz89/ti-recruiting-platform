import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  companyId: vi.fn(),
  jobs: vi.fn(),
  count: vi.fn(),
  invites: vi.fn(),
  attempts: vi.fn(),
  select: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.session,
}));

vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: mocks.companyId,
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    job: { findMany: mocks.jobs },
    assessmentInvite: {
      count: mocks.count,
      findMany: mocks.invites,
    },
    assessmentAttempt: {
      findMany: mocks.attempts,
    },
  },
}));

vi.mock("@/lib/assessments/dashboard-page-query", () => ({
  selectAssessmentPage: mocks.select,
}));

import { GET } from "@/app/api/dashboard/assessments/route";

describe("assessment dashboard global pagination", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.session.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });

    mocks.companyId.mockResolvedValue("company-a");

    mocks.jobs.mockResolvedValue([
      { id: "job-a", title: "Backend" },
    ]);

    const invites = Array.from({ length: 60 }, (_, index) => ({
      id: `invite-${index}`,
      status: "SENT",
      token: `token-${index}`,
      createdAt: new Date("2026-11-01T12:00:00Z"),
      updatedAt: new Date("2026-11-01T12:00:00Z"),
      sentAt: null,
      expiresAt: null,
      templateId: "template-a",
      candidateId: `candidate-${index}`,
      applicationId: `application-${index}`,
      template: {
        id: "template-a",
        title: "Backend Test",
        passingScore: 70,
      },
      candidate: {
        id: `candidate-${index}`,
        name: `Candidate ${index}`,
        email: `candidate${index}@example.invalid`,
      },
      application: {
        id: `application-${index}`,
        job: { id: "job-a", title: "Backend" },
      },
    }));

    const attempts = invites.slice(55).map((invite, index) => ({
      id: `attempt-${index}`,
      inviteId: invite.id,
      applicationId: invite.applicationId,
      templateId: invite.templateId,
      candidateId: invite.candidateId,
      status: "SUBMITTED",
      totalScore: index === 4 ? 99 : 75,
      passed: true,
      createdAt: new Date("2026-11-02T12:00:00Z"),
      submittedAt: new Date("2026-11-02T12:00:00Z"),
      expiresAt: null,
    }));

    const attemptsByInvite = new Map(
      attempts.map((attempt) => [attempt.inviteId, attempt])
    );

    // SQL selection is covered separately by PostgreSQL integration QA.
    // This mock tests the route's selection/hydration contract.
    mocks.select.mockImplementation(async (options: any) => {
      let selected = [...invites];

      if (options.state === "COMPLETED") {
        selected = selected.filter((inv) => attemptsByInvite.has(inv.id));
      }

      if (options.hasAttempt === "1") {
        selected = selected.filter((inv) => attemptsByInvite.has(inv.id));
      }

      if (options.hasAttempt === "0") {
        selected = selected.filter((inv) => !attemptsByInvite.has(inv.id));
      }

      if (options.sort === "score_desc") {
        selected.sort(
          (a, b) =>
            (attemptsByInvite.get(b.id)?.totalScore ?? -1) -
            (attemptsByInvite.get(a.id)?.totalScore ?? -1)
        );
      }

      const start = (options.page - 1) * options.take;

      return {
        total: selected.length,
        rows: selected.slice(start, start + options.take).map((inv) => ({
          inviteId: inv.id,
          attemptId: attemptsByInvite.get(inv.id)?.id ?? null,
          uiState: attemptsByInvite.has(inv.id) ? "COMPLETED" : "PENDING",
        })),
      };
    });

    mocks.invites.mockImplementation(async (args: any) => {
      const ids: string[] = args?.where?.id?.in ?? [];
      return invites.filter((inv) => ids.includes(inv.id));
    });

    mocks.attempts.mockImplementation(async (args: any) => {
      const ids: string[] = args?.where?.id?.in ?? [];
      return attempts.filter((attempt) => ids.includes(attempt.id));
    });
  });

  it("filters completed assessments before paginating", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/assessments?state=COMPLETED&hasAttempt=1"
      )
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.total).toBe(5);
    expect(body.totalPages).toBe(1);
    expect(body.rows).toHaveLength(5);
    expect(body.rows.every(
      (row: any) => row.uiState === "COMPLETED"
    )).toBe(true);

    expect(mocks.select).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-a",
        isAdmin: false,
        state: "COMPLETED",
        hasAttempt: "1",
        take: 50,
      })
    );

    const hydrationArgs = mocks.invites.mock.calls[0]?.[0];
    expect(hydrationArgs.where.application.job).toEqual({
      companyId: "company-a",
    });
    expect(hydrationArgs.where.id.in).toHaveLength(5);
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("sorts scores globally rather than within the first page", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/assessments?sort=score_desc"
      )
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.rows[0].attempt?.totalScore).toBe(99);
  });
});