import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  expiresAt: null as Date | null,
  candidateId: "candidate-a",
}));

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const tx = {
  $queryRaw: vi.fn(async () => []),
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
    createMany: vi.fn(async () => ({ count: 1 })),
    update: vi.fn(async () => ({ id: "answer-a" })),
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
    expect(tx.attemptAnswer.createMany).toHaveBeenCalledOnce();
  });

  it("rejects an answer at the exact deadline with 410 and no-store", async () => {
    state.expiresAt = new Date(0);
    const response = await POST(request(), { params: { attemptId: "attempt-a" } });
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "ASSESSMENT_EXPIRED",
    });
    expect(tx.attemptAnswer.createMany).not.toHaveBeenCalled();
  });

  it("checks ownership before revealing expiration", async () => {
    state.candidateId = "candidate-b";
    state.expiresAt = new Date(0);
    const response = await POST(request(), { params: { attemptId: "attempt-a" } });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.not.toHaveProperty("code");
  });

  it("keeps one authoritative answer when the same question is saved again", async () => {
    tx.attemptAnswer.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    tx.attemptAnswer.update.mockResolvedValue({ id: "answer-a" });

    const first = await POST(request(), { params: { attemptId: "attempt-a" } });
    const second = await POST(
      new Request("http://localhost/api/assessments/attempts/attempt-a/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: "question-a", selectedOptions: ["correct"] }),
      }),
      { params: { attemptId: "attempt-a" } },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(tx.attemptAnswer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        attemptId_questionId: {
          attemptId: "attempt-a",
          questionId: "question-a",
        },
      },
    }));
  });
});
