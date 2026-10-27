import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/assessments/code/execute/route";
import { judge0Service } from "@/lib/code-execution/judge0-service";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), executions: vi.fn(), answers: vi.fn(),
}));
const cases = [
  { id: "public-case", input: "public input", expectedOutput: "public output", isHidden: false, points: 1, timeoutMs: 1000, memoryLimitMb: 128, orderIndex: 0 },
  { id: "private-case", input: "SECRET_HIDDEN_INPUT", expectedOutput: "SECRET_HIDDEN_EXPECTED", isHidden: true, points: 1, timeoutMs: 1000, memoryLimitMb: 128, orderIndex: 1 },
];
const attempt = { id: "attempt-a", candidateId: "candidate-a", templateId: "template-a", status: "IN_PROGRESS", expiresAt: null };
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/code-execution/plagiarism", () => ({ checkPlagiarism: vi.fn(async () => undefined) }));
vi.mock("@/lib/server/prisma", () => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    assessmentAttempt: { findUnique: vi.fn(async () => attempt) },
    attemptAnswer: { upsert: mocks.answers },
  };
  return { prisma: {
    ...tx,
    assessmentQuestion: { findUnique: vi.fn(async () => ({ id: "question-a", templateId: "template-a", type: "CODING", isActive: true, allowedLanguages: ["python"] })) },
    codeTestCase: { findMany: vi.fn(async ({ where }) => where.isHidden === false ? cases.filter(test => !test.isHidden) : cases) },
    codeExecution: { count: vi.fn(async () => 0), create: mocks.executions },
    $transaction: vi.fn(async (work) => work(tx)),
  } };
});

function request(isSubmission = true) {
  return new Request("http://localhost/api/assessments/code/execute", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ attemptId: "attempt-a", questionId: "question-a", language: "python", code: "import sys\nprint(sys.stdin.read())", isSubmission }),
  });
}
function transport(hiddenPasses: boolean, publicError = "") {
  // Real Judge0Service and real route; only HTTP/auth/database are synthetic.
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ token: body.stdin === cases[1].input ? "private-token" : "public-token" }));
    }
    const hidden = url.includes("private-token");
    return new Response(JSON.stringify({
      status: { id: hidden ? (hiddenPasses ? 3 : 6) : (publicError ? 6 : 3), description: "Runtime Error" },
      stdout: Buffer.from(hidden ? "SECRET_HIDDEN_STDOUT" : "public output").toString("base64"),
      stderr: Buffer.from(hidden && !hiddenPasses ? "SECRET_HIDDEN_STDERR\nSECRET_INTERNAL_STACK" : publicError).toString("base64"),
      time: hidden ? "0.123" : "0.01", memory: hidden ? 65536 : 1024,
    }));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function noSecrets(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(/SECRET_[A-Z_]+/);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "candidate-a", role: "CANDIDATE" } });
  mocks.executions.mockResolvedValue({ id: "execution-a" });
  mocks.answers.mockResolvedValue({ id: "answer-a" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("candidate coding execution response boundary", () => {
  it.each([false, true])("never serializes hidden stdout/stderr or metadata while preserving scoring (hidden passes=%s)", async hiddenPasses => {
    const fetch = transport(hiddenPasses);
    const response = await POST(request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    noSecrets(payload);
    expect(payload.result).toMatchObject({ success: hiddenPasses, pointsEarned: hiddenPasses ? 1 : 0, passedTests: hiddenPasses ? 2 : 1, totalTests: 2 });
    const hidden = payload.result.testResults.find((result: { hidden: boolean }) => result.hidden);
    expect(hidden).toEqual({ testCaseId: "hidden-2", hidden: true, passed: hiddenPasses });
    expect(payload.result).not.toHaveProperty("executionTimeMs");
    expect(payload.result).not.toHaveProperty("memoryUsedMb");
    expect(mocks.answers).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      pointsEarned: hiddenPasses ? 1 : 0, isCorrect: hiddenPasses,
      executionResults: expect.arrayContaining([expect.objectContaining({ input: cases[1].input, expectedOutput: cases[1].expectedOutput, actualOutput: "SECRET_HIDDEN_STDOUT" })]),
    }) }));
    expect(mocks.executions).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ output: expect.stringContaining("SECRET_HIDDEN_STDOUT") }) }));
    const submissions = fetch.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => JSON.parse(String(init?.body)));
    expect(submissions).toEqual(expect.arrayContaining([expect.objectContaining({ stdin: cases[1].input, expected_output: cases[1].expectedOutput })]));
  });

  it("preserves public examples and candidate program diagnostics on public runs", async () => {
    const fetch = transport(false, "ValueError: public candidate diagnostic");
    const response = await POST(request(false));
    const payload = await response.json();
    noSecrets(payload);
    expect(payload.result.testResults).toEqual([expect.objectContaining({
      testCaseId: "public-case", hidden: false, passed: false,
      input: "public input", expectedOutput: "public output", actualOutput: "public output", error: "ValueError: public candidate diagnostic",
    })]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mocks.answers).not.toHaveBeenCalled();
  });

  it("does not serialize raw provider error bodies even when only public tests run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "SECRET_PROVIDER_BODY", stack: "SECRET_PROVIDER_STACK" }), { status: 503 })));
    const response = await POST(request(false));
    const payload = await response.json();
    noSecrets(payload);
    expect(payload.result.success).toBe(false);
    expect(payload.result.testResults[0].error).toBe("No se pudo ejecutar el código. Intenta de nuevo.");
    expect(mocks.executions).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ testResults: expect.arrayContaining([expect.objectContaining({ error: expect.stringContaining("SECRET_PROVIDER_BODY") })]) }) }));
  });

  it.each([13, 999])("keeps provider-internal/unknown status %s private even if it contains stdout or stderr", async id => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => new Response(JSON.stringify(init?.method === "POST" ? { token: "test-token" } : {
      status: { id, description: "SECRET_STATUS_DESCRIPTION" },
      stdout: Buffer.from("SECRET_PROVIDER_STDOUT").toString("base64"),
      stderr: Buffer.from("SECRET_PROVIDER_STDERR").toString("base64"),
    }))));
    const response = await POST(request(false));
    const payload = await response.json();
    noSecrets(payload);
    expect(payload.result.testResults[0].error).toBe("No se pudo ejecutar el código. Intenta de nuevo.");
  });

  it("uses a fixed diagnostic instead of trusting provider status descriptions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => new Response(JSON.stringify(init?.method === "POST" ? { token: "test-token" } : {
      status: { id: 5, description: "SECRET_STATUS_DESCRIPTION" },
    }))));
    const response = await POST(request(false));
    const payload = await response.json();
    noSecrets(payload);
    expect(payload.result.testResults[0].error).toBe("Tiempo de ejecución agotado.");
  });

  it.each(["SECRET_PROVIDER_EXCEPTION", "Rate limit SECRET_PROVIDER_EXCEPTION"])("keeps thrown provider exceptions private: %s", async message => {
    vi.spyOn(judge0Service, "executeCode").mockRejectedValueOnce(new Error(message));
    const response = await POST(request());
    expect(response.status).toBe(500);
    const payload = await response.json();
    noSecrets(payload);
    expect(payload).toEqual({ error: "Error al ejecutar el código" });
    expect(mocks.answers).not.toHaveBeenCalled();
  });

  it("fails closed on unknown result IDs and never trusts aggregate text or provider metadata", async () => {
    vi.spyOn(judge0Service, "executeCode").mockResolvedValueOnce(JSON.parse(JSON.stringify({
      success: false, status: "SECRET_STATUS", output: "SECRET_AGGREGATE", error: "SECRET_AGGREGATE_ERROR",
      executionTimeMs: 100, memoryUsedMb: 10,
      testResults: [
        { testCaseId: "public-case", passed: true, input: "SECRET_WRONG_INPUT", expectedOutput: "SECRET_WRONG_EXPECTED", actualOutput: "public output", extra: "SECRET_EXTRA" },
        { testCaseId: "SECRET_UNKNOWN_ID", passed: false, input: "SECRET_INPUT", expectedOutput: "SECRET_EXPECTED", actualOutput: "SECRET_OUTPUT", error: "SECRET_ERROR" },
      ],
    })));
    const response = await POST(request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    noSecrets(payload);
    expect(payload.result.testResults[1]).toEqual({ testCaseId: "hidden-2", hidden: true, passed: false });
  });
});
