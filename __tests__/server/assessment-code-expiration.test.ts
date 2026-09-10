import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  expiresAt: null as Date | null,
  status: "IN_PROGRESS",
  events: [] as string[],
}));

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  executeCode: vi.fn(),
}));

const attemptRow = () => ({
  id: "attempt-a",
  candidateId: "candidate-a",
  templateId: "template-a",
  status: state.status,
  expiresAt: state.expiresAt,
});

const tx = {
  $queryRaw: vi.fn(async () => []),
  assessmentAttempt: { findUnique: vi.fn(async () => attemptRow()) },
  attemptAnswer: {
    upsert: vi.fn(async () => {
      state.events.push("answer-saved");
      return { id: "answer-a" };
    }),
  },
  codeExecution: {
    create: vi.fn(async () => ({ id: "execution-a" })),
  },
};

const prismaMock = {
  assessmentAttempt: { findUnique: vi.fn(async () => attemptRow()) },
  assessmentQuestion: {
    findUnique: vi.fn(async () => ({
      id: "question-a",
      templateId: "template-a",
      type: "CODING",
      allowedLanguages: ["javascript"],
    })),
  },
  codeTestCase: {
    findMany: vi.fn(async () => [{
      id: "test-a",
      input: "",
      expectedOutput: "ok",
      isHidden: true,
      points: 1,
      timeoutMs: 1000,
      memoryLimitMb: 128,
      orderIndex: 0,
    }]),
  },
  codeExecution: {
    count: vi.fn(async () => 0),
    create: vi.fn(async () => ({ id: "execution-a" })),
  },
  attemptAnswer: tx.attemptAnswer,
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/code-execution/judge0-service", () => ({
  judge0Service: {
    isLanguageSupported: () => true,
    getSupportedLanguages: () => ["javascript"],
    executeCode: mocks.executeCode,
  },
}));
vi.mock("@/lib/code-execution/plagiarism", () => ({
  checkPlagiarism: vi.fn(async () => undefined),
}));
vi.mock("@/lib/code-execution/sql-service", () => ({ validateReadOnlySqlQuery: vi.fn() }));

let POST: typeof import("@/app/api/assessments/code/execute/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/assessments/code/execute/route"));
});

function request() {
  return new Request("http://localhost/api/assessments/code/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: "attempt-a",
      questionId: "question-a",
      code: "console.log('ok')",
      language: "javascript",
      isSubmission: true,
    }),
  });
}

describe("scored code persistence deadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.expiresAt = null;
    state.status = "IN_PROGRESS";
    state.events.length = 0;
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
    mocks.executeCode.mockResolvedValue({
      success: true,
      status: "SUCCESS",
      output: "ok",
      error: "",
      executionTimeMs: 10,
      memoryUsedMb: 1,
      testResults: [{ testCaseId: "test-a", passed: true }],
    });
  });

  it("persists a scored answer for a legacy attempt without a deadline", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(tx.attemptAnswer.upsert).toHaveBeenCalledOnce();
  });

  it("does not persist a scored answer when the attempt expires while Judge0 runs", async () => {
    state.expiresAt = new Date(Date.now() + 60_000);
    mocks.executeCode.mockImplementationOnce(async () => {
      state.expiresAt = new Date(0);
      return {
        success: true,
        status: "SUCCESS",
        output: "ok",
        error: "",
        executionTimeMs: 10,
        memoryUsedMb: 1,
        testResults: [{ testCaseId: "test-a", passed: true }],
      };
    });

    const response = await POST(request());
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      code: "ASSESSMENT_EXPIRED",
    });
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
  });

  it("does not persist a scored answer when submission finishes while Judge0 runs", async () => {
    mocks.executeCode.mockImplementationOnce(async () => {
      state.status = "SUBMITTED";
      return {
        success: true,
        status: "SUCCESS",
        output: "ok",
        error: "",
        executionTimeMs: 10,
        memoryUsedMb: 1,
        testResults: [{ testCaseId: "test-a", passed: true }],
      };
    });

    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
  });
});
