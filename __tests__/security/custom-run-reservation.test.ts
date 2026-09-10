import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  recentCount: 0,
  nextId: 0,
  transactionCommitted: false,
  events: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
  attemptExpiresAt: new Date(Date.now() + 60_000) as Date | null,
}));

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  executeCode: vi.fn(),
}));

const tx = {
  $queryRaw: vi.fn(async () => []),
  assessmentAttempt: {
    findUnique: vi.fn(async () => ({
      id: "attempt-a",
      candidateId: "candidate-a",
      templateId: "template-a",
      status: "IN_PROGRESS",
      expiresAt: state.attemptExpiresAt,
    })),
  },
  assessmentQuestion: {
    findFirst: vi.fn(async () => ({ id: "question-a" })),
  },
  codeExecution: {
    count: vi.fn(async () => state.recentCount),
    create: vi.fn(async () => {
      state.events.push("reserve");
      state.recentCount += 1;
      state.nextId += 1;
      return { id: `execution-${state.nextId}` };
    }),
  },
};

let transactionQueue = Promise.resolve();
const prismaMock = {
  $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
    const previous = transactionQueue;
    let release = () => {};
    transactionQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const result = await callback(tx);
      state.transactionCommitted = true;
      state.events.push("commit");
      return result;
    } finally {
      release();
    }
  }),
  codeExecution: {
    update: vi.fn(async (args: Record<string, unknown>) => {
      state.updates.push(args);
      return args;
    }),
  },
};

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/code-execution/judge0-service", () => ({
  judge0Service: {
    isLanguageSupported: () => true,
    executeCode: mocks.executeCode,
  },
}));

let POST: typeof import("@/app/api/assessments/code/custom-run/route")["POST"];

beforeAll(async () => {
  ({ POST } = await import("@/app/api/assessments/code/custom-run/route"));
});

function request() {
  return new Request("http://localhost/api/assessments/code/custom-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attemptId: "attempt-a",
      questionId: "question-a",
      code: "console.log(input)",
      language: "javascript",
      customInput: "hello",
    }),
  });
}

describe("custom-run reservation", () => {
  beforeEach(() => {
    state.recentCount = 0;
    state.nextId = 0;
    state.transactionCommitted = false;
    state.events.length = 0;
    state.updates.length = 0;
    state.attemptExpiresAt = new Date(Date.now() + 60_000);
    transactionQueue = Promise.resolve();
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "candidate-a", role: "CANDIDATE" },
    });
    mocks.executeCode.mockImplementation(async () => {
      expect(state.transactionCommitted).toBe(true);
      state.events.push("judge0");
      return {
        status: "SUCCESS",
        output: "hello",
        error: "",
        executionTimeMs: 12,
        testResults: [{ actualOutput: "hello" }],
      };
    });
  });

  it("commits a CodeExecution reservation before calling Judge0", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(state.events.slice(0, 3)).toEqual(["reserve", "commit", "judge0"]);
    expect(state.updates[state.updates.length - 1]).toMatchObject({
      data: { status: "CUSTOM_COMPLETED" },
    });
  });

  it("serializes concurrent reservations and never exceeds the limit", async () => {
    const responses = await Promise.all(
      Array.from({ length: 31 }, () => POST(request()))
    );
    expect(responses.filter((response) => response.status === 200)).toHaveLength(30);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
    expect(tx.codeExecution.create).toHaveBeenCalledTimes(30);
    expect(mocks.executeCode).toHaveBeenCalledTimes(30);
  });

  it("counts Judge0 failures by retaining the reservation as CUSTOM_ERROR", async () => {
    mocks.executeCode.mockRejectedValueOnce(new Error("Judge0 unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(state.recentCount).toBe(1);
    expect(state.updates[state.updates.length - 1]).toMatchObject({
      data: { status: "CUSTOM_ERROR", error: "Judge0 unavailable" },
    });
  });

  it("allows a legacy attempt with no deadline", async () => {
    state.attemptExpiresAt = null;
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.executeCode).toHaveBeenCalledOnce();
  });

  it("rejects an attempt at its exact deadline with the canonical expired response", async () => {
    state.attemptExpiresAt = new Date(0);
    const response = await POST(request());
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      code: "ASSESSMENT_EXPIRED",
    });
    expect(mocks.executeCode).not.toHaveBeenCalled();
  });
});
