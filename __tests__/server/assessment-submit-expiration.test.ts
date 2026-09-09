import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ expiresAt: null as Date | null }));
const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const attempt = () => ({
  id: "attempt-a",
  candidateId: "candidate-a",
  templateId: "template-a",
  applicationId: null,
  inviteId: null,
  status: "IN_PROGRESS",
  startedAt: new Date(Date.now() - 60_000),
  expiresAt: state.expiresAt,
  totalScore: null,
  sectionScores: null,
  passed: null,
  timeSpent: 0,
  flagsJson: {},
  severity: "NORMAL",
  template: {
    passingScore: 70,
    sections: [],
    isBadgeExam: false,
    badgeTermId: null,
    badgeLevel: null,
  },
  answers: [{
    questionId: "question-a",
    pointsEarned: 1,
    timeSpent: 10,
    question: { section: null },
  }],
  invite: null,
  candidate: { id: "candidate-a", name: "Candidate A", email: "a@example.com" },
  contestRegistration: null,
});

const tx = {
  assessmentAttempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
  candidateBadge: { deleteMany: vi.fn() },
  assessmentInvite: { updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  assessmentInviteChargeLedger: { updateMany: vi.fn(async () => ({ count: 0 })) },
  contestRegistration: { update: vi.fn() },
  candidateSkill: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

const prismaMock = {
  assessmentAttempt: { findUnique: vi.fn(async () => attempt()) },
  assessmentQuestion: {
    findMany: vi.fn(async () => [{
      id: "question-a",
      section: null,
      type: "MULTIPLE_CHOICE",
      testCases: [],
    }]),
  },
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/notifications/service", () => ({
  NotificationService: { create: vi.fn(async () => undefined) },
}));

let POST: typeof import("@/app/api/assessments/attempts/[attemptId]/submit/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/assessments/attempts/[attemptId]/submit/route"));
});

describe("assessment submission expiration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.expiresAt = null;
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
  });

  it("submits a legacy attempt with no deadline", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: { attemptId: "attempt-a" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ expired: false });
  });

  it("finalizes saved answers when submission occurs after expiry", async () => {
    state.expiresAt = new Date(0);
    const response = await POST(new Request("http://localhost"), {
      params: { attemptId: "attempt-a" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      expired: true,
    });
    expect(tx.assessmentAttempt.updateMany).toHaveBeenCalledOnce();
  });
});
