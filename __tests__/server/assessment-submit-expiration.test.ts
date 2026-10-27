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
  totalScore: null as number | null,
  sectionScores: null,
  passed: null as boolean | null,
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
  $queryRaw: vi.fn(async () => []),
  assessmentAttempt: { findUnique: vi.fn(async () => attempt()), updateMany: vi.fn(async () => ({ count: 1 })) },
  assessmentQuestion: { findMany: vi.fn(async () => [{ id: "question-a", section: null, type: "MULTIPLE_CHOICE", testCases: [] }]) },
  candidateBadge: { deleteMany: vi.fn() },
  assessmentInvite: { updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  assessmentInviteChargeLedger: { updateMany: vi.fn(async () => ({ count: 0 })) },
  contestRegistration: { update: vi.fn() },
  candidateSkill: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

const prismaMock = {
  assessmentAttempt: { findUnique: tx.assessmentAttempt.findUnique },
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
  it("performs the final state transition only through the guarded submit handler and treats a retry idempotently", async () => {
    const first = await POST(new Request("http://localhost"), { params: { attemptId: "attempt-a" } });
    expect(first.status).toBe(200);
    expect(tx.assessmentAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "attempt-a", candidateId: "candidate-a", status: "IN_PROGRESS" },
      data: expect.objectContaining({ status: "SUBMITTED", totalScore: 100 }),
    }));
    prismaMock.assessmentAttempt.findUnique.mockResolvedValueOnce({ ...attempt(), status: "SUBMITTED", totalScore: 100, passed: true });
    const retried = await POST(new Request("http://localhost"), { params: { attemptId: "attempt-a" } });
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ alreadySubmitted: true, totalScore: 100 });
    expect(tx.assessmentAttempt.updateMany).toHaveBeenCalledOnce();
  });
  it("does not complete a second concurrent finalization when the atomic state claim loses", async () => {
    tx.assessmentAttempt.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const responses = await Promise.all([
      POST(new Request("http://localhost"), { params: { attemptId: "attempt-a" } }),
      POST(new Request("http://localhost"), { params: { attemptId: "attempt-a" } }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
    for (const invocation of [1, 2]) {
      expect(tx.assessmentAttempt.updateMany).toHaveBeenNthCalledWith(invocation, expect.objectContaining({ where: { id: "attempt-a", candidateId: "candidate-a", status: "IN_PROGRESS" } }));
    }
  });
});
