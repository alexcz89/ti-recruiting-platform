import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  expiresAt: null as Date | null,
  candidateId: "candidate-a",
}));

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const tx = {
  assessmentAttempt: {
    findUnique: vi.fn(async () => ({
      id: "attempt-a",
      candidateId: state.candidateId,
      templateId: "template-a",
      status: "IN_PROGRESS",
      expiresAt: state.expiresAt,
      flagsJson: { questionOrder: ["question-a"] },
      template: { penalizeWrong: false },
    })),
  },
  assessmentQuestion: {
    findFirst: vi.fn(async () => ({
      id: "question-a",
      type: "MULTIPLE_CHOICE",
      allowMultiple: false,
      options: [{ id: "correct", isCorrect: true }],
    })),
    update: vi.fn(async () => ({})),
  },
  attemptAnswer: {
    create: vi.fn(async () => ({ id: "answer-a" })),
    update: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({
  prisma: { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) },
}));

let POST: typeof import("@/app/api/assessments/attempts/[attemptId]/answer/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/assessments/attempts/[attemptId]/answer/route"));
});

function request() {
  return new Request("http://localhost/api/assessments/attempts/attempt-a/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ questionId: "question-a", selectedOptions: ["correct"] }),
  });
}

describe("assessment answer expiration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.expiresAt = null;
    state.candidateId = "candidate-a";
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
  });

  it("allows an answer for a legacy attempt with null expiresAt", async () => {
    const response = await POST(request(), { params: { attemptId: "attempt-a" } });
    expect(response.status).toBe(200);
    expect(tx.attemptAnswer.create).toHaveBeenCalledOnce();
  });

  it("rejects an answer at the exact deadline with 410 and no-store", async () => {
    state.expiresAt = new Date(0);
    const response = await POST(request(), { params: { attemptId: "attempt-a" } });
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "ASSESSMENT_EXPIRED",
    });
    expect(tx.attemptAnswer.create).not.toHaveBeenCalled();
  });

  it("checks ownership before revealing expiration", async () => {
    state.candidateId = "candidate-b";
    state.expiresAt = new Date(0);
    const response = await POST(request(), { params: { attemptId: "attempt-a" } });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.not.toHaveProperty("code");
  });
});
