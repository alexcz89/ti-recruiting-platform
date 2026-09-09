import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  sendAssessmentInviteEmail: vi.fn(),
}));

const expiredInvite = {
  id: "invite-a",
  token: "token-a",
  status: "STARTED",
  sentAt: new Date(0),
  expiresAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const activeAttempt = {
  id: "attempt-a",
  status: "IN_PROGRESS",
  createdAt: new Date(),
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
};

const tx = {
  assessmentInvite: {
    findFirst: vi.fn(async () => expiredInvite),
    update: vi.fn(),
  },
  assessmentAttempt: {
    findFirst: vi.fn(async () => ({ id: "attempt-a" })),
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  application: {
    findFirst: vi.fn(async () => ({
      id: "application-a",
      jobId: "job-a",
      candidateId: "candidate-a",
      candidate: { id: "candidate-a", email: "a@example.com", name: "Candidate A" },
      job: {
        id: "job-a",
        title: "Job A",
        companyId: "company-a",
        company: { id: "company-a", name: "Company A", assessmentCredits: 1 },
        assessments: [{
          id: "job-assessment-a",
          templateId: "template-a",
          isRequired: true,
          minScore: 70,
          createdAt: new Date(0),
        }],
      },
    })),
  },
  assessmentTemplate: {
    findUnique: vi.fn(async () => ({
      id: "template-a",
      title: "Assessment",
      timeLimit: 30,
      type: "TECHNICAL",
      difficulty: "EASY",
    })),
  },
  recruiterProfile: { findUnique: vi.fn(async () => ({ id: "profile-a", companyId: "company-a" })) },
  assessmentInvite: { update: vi.fn(async () => expiredInvite) },
  assessmentAttempt: { findFirst: vi.fn(async () => activeAttempt) },
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: vi.fn(async () => "company-a") }));
vi.mock("@/lib/server/mailer", () => ({ sendAssessmentInviteEmail: mocks.sendAssessmentInviteEmail }));
vi.mock("@/lib/notifications/service", () => ({
  NotificationService: { create: vi.fn(async () => undefined) },
}));

let POST: typeof import("@/app/api/applications/[id]/assessment-invite/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/applications/[id]/assessment-invite/route"));
});

describe("assessment invite resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "recruiter-a", role: "RECRUITER" },
    });
    mocks.sendAssessmentInviteEmail.mockResolvedValue({ ok: true });
  });

  it("does not rotate, renew, unlink, replace, or shorten an active attempt", async () => {
    const response = await POST(
      new Request("http://localhost/api/applications/application-a/assessment-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: "template-a", expiresInDays: 1 }),
      }),
      { params: { id: "application-a" } }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.rotated).toBe(false);
    expect(body.attempt.id).toBe("attempt-a");
    expect(new Date(body.attempt.expiresAt).toISOString()).toBe(activeAttempt.expiresAt.toISOString());
    expect(tx.assessmentInvite.update).not.toHaveBeenCalled();
    expect(tx.assessmentAttempt.updateMany).not.toHaveBeenCalled();
  });
});
