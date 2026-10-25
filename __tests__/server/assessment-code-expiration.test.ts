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

function request(isSubmission = true) {
  return new Request("http://localhost/api/assessments/code/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: "attempt-a",
      questionId: "question-a",
      code: "console.log('ok')",
      language: "javascript",
      isSubmission,
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
    expect(mocks.executeCode).toHaveBeenCalledWith({
      code: "console.log('ok')",
      language: "javascript",
      testCases: [
        {
          id: "test-a",
          input: "",
          expectedOutput: "ok",
          timeoutMs: 1000,
          memoryLimitMb: 128,
        },
      ],
    });
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
  it.each([false, true])("a public run (passed=%s) loads only public tests and never persists a scored answer", async (passed) => {
    const publicTest = { id: "public-a", input: "public-input", expectedOutput: "public-output", isHidden: false, points: 1, timeoutMs: 1000, memoryLimitMb: 128, orderIndex: 0 };
    prismaMock.codeTestCase.findMany.mockResolvedValueOnce([publicTest]);
    mocks.executeCode.mockResolvedValueOnce({ success: passed, status: passed ? "SUCCESS" : "RUNTIME_ERROR", output: "public-output", error: passed ? "" : "NotImplementedError: TODO", testResults: [{ testCaseId: "public-a", passed, input: "public-input", expectedOutput: "public-output", actualOutput: "public-output" }] });
    const response = await POST(request(false));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prismaMock.codeTestCase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { questionId: "question-a", isHidden: false } }));
    expect(mocks.executeCode).toHaveBeenCalledWith(expect.objectContaining({ testCases: [expect.objectContaining({ id: "public-a", input: "public-input" })] }));
    const result = await response.json();
    expect(result.result).not.toHaveProperty("pointsEarned");
    expect(result.result.testResults).toEqual([expect.objectContaining({ hidden: false, input: "public-input", expectedOutput: "public-output" })]);
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.codeExecution.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isSubmission: false }) }));
    expect(state.status).toBe("IN_PROGRESS");
  });
  it("keeps full hidden test data server-side when explicitly submitting code, without finalizing the attempt", async () => {
    mocks.executeCode.mockResolvedValueOnce({ success: true, status: "SUCCESS", output: "ok", testResults: [{ testCaseId: "test-a", passed: true, input: "secret-input", expectedOutput: "secret-expected", actualOutput: "secret-actual" }] });
    const response = await POST(request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).not.toMatch(/secret-input|secret-expected|secret-actual/);
    expect(payload.result.testResults).toEqual([{ testCaseId: "test-a", passed: true, hidden: true }]);
    expect(tx.attemptAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ codeSubmission: "console.log('ok')", selectedOptions: ["__CODE_SUBMITTED__"], executionResults: [expect.objectContaining({ input: "secret-input" })] }) }));
    expect(state.status).toBe("IN_PROGRESS");
  });
  it.each([
    [null, 401],
    [{ user: { id: "recruiter-a", role: "RECRUITER" } }, 403],
    [{ user: { id: "candidate-b", role: "CANDIDATE" } }, 403],
  ])("rejects unauthorized public runs: %j", async (session, status) => {
    mocks.getServerSession.mockResolvedValue(session);
    expect((await POST(request(false))).status).toBe(status);
    expect(mocks.executeCode).not.toHaveBeenCalled();
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
  });
  it.each(["NOT_STARTED", "SUBMITTED", "EVALUATED", "COMPLETED"])("rejects a public run in state %s", async (status) => {
    state.status = status;
    expect((await POST(request(false))).status).toBe(400);
    expect(mocks.executeCode).not.toHaveBeenCalled();
  });
  it("rejects expired public runs without executing or saving code", async () => {
    state.expiresAt = new Date(0);
    expect((await POST(request(false))).status).toBe(410);
    expect(mocks.executeCode).not.toHaveBeenCalled();
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
  });
  it("rejects another template's question on a public run", async () => {
    prismaMock.assessmentQuestion.findUnique.mockResolvedValueOnce({ id: "private-question", templateId: "template-b", type: "CODING", allowedLanguages: ["javascript"] });
    expect((await POST(request(false))).status).toBe(400);
    expect(mocks.executeCode).not.toHaveBeenCalled();
  });
  it("retains the existing public execution rate limit", async () => {
    prismaMock.codeExecution.count.mockResolvedValueOnce(20);
    expect((await POST(request(false))).status).toBe(429);
    expect(mocks.executeCode).not.toHaveBeenCalled();
  });
});
