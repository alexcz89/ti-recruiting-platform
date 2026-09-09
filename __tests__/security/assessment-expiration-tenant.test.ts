import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sessionCompanyId: "company-a" as string | null,
  inviteExpiresAt: new Date(0),
  attemptExpiresAt: null as Date | null,
  includeDashboardAttempt: false,
}));

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const inviteRow = () => ({
  id: "invite-a",
  status: "SENT",
  token: "token-a",
  sentAt: new Date(0),
  expiresAt: state.inviteExpiresAt,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  templateId: "template-a",
  template: { id: "template-a", title: "Assessment", difficulty: "EASY", passingScore: 70, timeLimit: 30 },
  candidateId: "candidate-a",
  candidate: { id: "candidate-a", name: "Candidate A", email: "a@example.com" },
  applicationId: "application-a",
  application: { id: "application-a", job: { id: "job-a", title: "Job A" } },
});

const dashboardAttempt = () => ({
  id: "attempt-dashboard",
  status: "IN_PROGRESS",
  totalScore: null,
  passed: null,
  submittedAt: null,
  createdAt: new Date(),
  startedAt: new Date(),
  expiresAt: state.attemptExpiresAt,
  inviteId: "invite-a",
  applicationId: "application-a",
  templateId: "template-a",
  candidateId: "candidate-a",
  severity: "NORMAL",
  severityScore: 0,
  multiSession: false,
});

const resultAttempt = () => ({
  id: "attempt-result",
  status: "SUBMITTED",
  attemptNumber: 1,
  candidateId: "candidate-a",
  templateId: "template-a",
  applicationId: "application-a",
  inviteId: "invite-a",
  startedAt: new Date(),
  submittedAt: new Date(),
  expiresAt: null,
  timeSpent: 10,
  totalScore: 100,
  sectionScores: {},
  passed: true,
  flagsJson: {},
  tabSwitches: 0,
  visibilityHidden: 0,
  copyAttempts: 0,
  pasteAttempts: 0,
  rightClicks: 0,
  focusLoss: 0,
  pageHides: 0,
  multiSession: false,
  severity: "NORMAL",
  severityScore: 0,
  template: {
    id: "template-a",
    title: "Assessment",
    difficulty: "EASY",
    passingScore: 70,
    sections: [],
    isBadgeExam: false,
    badgeLevel: null,
    badgeTerm: null,
  },
  application: { id: "application-a", job: { id: "job-a", companyId: "company-a" } },
  invite: { id: "invite-a", application: { id: "application-a", job: { id: "job-a", companyId: "company-a" } } },
  badge: null,
});

const prismaMock = {
  job: { findMany: vi.fn(async () => [{ id: "job-a", title: "Job A" }]) },
  assessmentInvite: {
    count: vi.fn(async () => 1),
    findMany: vi.fn(async () => [inviteRow()]),
  },
  assessmentAttempt: {
    findMany: vi.fn(async () => state.includeDashboardAttempt ? [dashboardAttempt()] : []),
    findUnique: vi.fn(async () => resultAttempt()),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  attemptAnswer: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
  },
  assessmentQuestion: { count: vi.fn(async () => 1) },
  user: { findUnique: vi.fn(async () => ({ id: "candidate-a", name: "Candidate A", email: "a@example.com" })) },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({
  getSessionCompanyId: vi.fn(async () => state.sessionCompanyId),
}));

let dashboardGET: typeof import("@/app/api/dashboard/assessments/route")["GET"];
let resultsGET: typeof import("@/app/api/assessments/attempts/[attemptId]/results/route")["GET"];

beforeAll(async () => {
  ({ GET: dashboardGET } = await import("@/app/api/dashboard/assessments/route"));
  ({ GET: resultsGET } = await import("@/app/api/assessments/attempts/[attemptId]/results/route"));
});

describe("assessment expiration remains tenant isolated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionCompanyId = "company-a";
    state.inviteExpiresAt = new Date(0);
    state.attemptExpiresAt = null;
    state.includeDashboardAttempt = false;
    mocks.getServerSession.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });
  });

  it("shows an expired invite explicitly in the recruiter dashboard", async () => {
    const response = await dashboardGET(new Request("http://localhost/api/dashboard/assessments"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rows[0].uiState).toBe("EXPIRED");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("shows a legacy active attempt as in progress even when its invite expired", async () => {
    state.includeDashboardAttempt = true;
    const response = await dashboardGET(new Request("http://localhost/api/dashboard/assessments"));
    const body = await response.json();
    expect(body.rows[0].uiState).toBe("IN_PROGRESS");
  });

  it("allows the owning recruiter to view results for a legacy null-deadline attempt", async () => {
    const response = await resultsGET(new Request("http://localhost"), {
      params: { attemptId: "attempt-result" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.attempt.expiresAt).toBeNull();
    expect(body.attempt.expiredAtSubmission).toBe(false);
  });

  it("returns 404 without result details to a recruiter from another company", async () => {
    state.sessionCompanyId = "company-b";
    const response = await resultsGET(new Request("http://localhost"), {
      params: { attemptId: "attempt-result" },
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Intento no encontrado" });
    expect(prismaMock.attemptAnswer.findMany).not.toHaveBeenCalled();
  });
});
