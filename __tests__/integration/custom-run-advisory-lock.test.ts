import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_CUSTOM_RUN_DB_TESTS === "true";
const databaseUrl = process.env.DATABASE_URL ?? "";
function isDisposableDatabase(value: string) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" &&
      url.port === "55435" && url.pathname === "/taskio_custom_run_lock_qa" && url.username === "taskio_sql_qa";
  } catch { return false; }
}
if (enabled && (!isDisposableDatabase(databaseUrl) || process.env.DIRECT_URL !== databaseUrl)) {
  throw new Error("Custom-run SQL tests require the explicit disposable loopback database and matching DIRECT_URL.");
}
const describeDatabase = enabled ? describe : describe.skip;
const mocks = vi.hoisted(() => ({ executeCode: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: ids.candidate, role: "CANDIDATE" } })) }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/code-execution/plagiarism", () => ({ checkPlagiarism: vi.fn(async () => undefined) }));
vi.mock("@/lib/code-execution/judge0-service", () => ({ judge0Service: {
  isLanguageSupported: () => true, getSupportedLanguages: () => ["python"], executeCode: mocks.executeCode,
} }));

const prefix = "qa-custom-run-" + randomUUID();
const ids = { candidate: prefix + "-candidate", template: prefix + "-template", question: prefix + "-question", attempt: prefix + "-attempt" };
let db: PrismaClient;
let customRun: typeof import("@/app/api/assessments/code/custom-run/route")["POST"];
let execute: typeof import("@/app/api/assessments/code/execute/route")["POST"];
function request(submission = false) {
  return new Request("http://localhost/api/assessments/code/" + (submission ? "execute" : "custom-run"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      attemptId: ids.attempt, questionId: ids.question, language: "python", code: "candidate program", customInput: "own input", isSubmission: submission,
    }),
  });
}

describeDatabase("custom-run with real Prisma/PostgreSQL transactions (no database or SQL mocks)", () => {
  beforeAll(async () => {
    // Explicit guarded environment only. Never import the database singleton in a skipped run.
    db = (await import("@/lib/server/prisma")).prisma;
    await db.$connect();
    customRun = (await import("@/app/api/assessments/code/custom-run/route")).POST;
    execute = (await import("@/app/api/assessments/code/execute/route")).POST;
    await db.user.create({ data: { id: ids.candidate, email: prefix + "@example.invalid", role: "CANDIDATE" } });
    await db.assessmentTemplate.create({ data: {
      id: ids.template, slug: prefix, title: "Disposable SQL QA", type: "CODING", difficulty: "JUNIOR", totalQuestions: 1,
      passingScore: 70, timeLimit: 30, sections: [{ name: "General", questions: 1 }], language: "python",
    } });
    await db.assessmentQuestion.create({ data: {
      id: ids.question, templateId: ids.template, type: "CODING", questionText: "Synthetic QA", section: "General", difficulty: "JUNIOR",
      tags: [], options: [], language: "python", allowedLanguages: '["python"]', testCases: { create: [
        { input: "public input", expectedOutput: "public output", isHidden: false },
        { input: "SECRET_HIDDEN_INPUT", expectedOutput: "SECRET_HIDDEN_OUTPUT", isHidden: true },
      ] },
    } });
    await db.assessmentAttempt.create({ data: { id: ids.attempt, candidateId: ids.candidate, templateId: ids.template, status: "IN_PROGRESS" } });
  }, 20_000);

  beforeEach(async () => {
    await db.codeExecution.deleteMany({ where: { attemptId: ids.attempt } });
    await db.attemptAnswer.deleteMany({ where: { attemptId: ids.attempt } });
    await db.assessmentAttempt.update({ where: { id: ids.attempt }, data: { status: "IN_PROGRESS", expiresAt: new Date(Date.now() + 60_000) } });
    vi.clearAllMocks();
    mocks.executeCode.mockImplementation(async ({ testCases }: { testCases: Array<{ id: string; input: string; expectedOutput: string }> }) => ({
      success: true, status: "SUCCESS", output: testCases.map(test => test.expectedOutput).join("\n"),
      testResults: testCases.map(test => ({ testCaseId: test.id, input: test.input, expectedOutput: test.expectedOutput,
        actualOutput: test.id === "custom" ? "own output" : test.expectedOutput, passed: true, errorSource: "program" })),
    }));
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await db.assessmentAttempt.deleteMany({ where: { id: ids.attempt } });
      await db.assessmentTemplate.deleteMany({ where: { id: ids.template } });
      await db.user.deleteMany({ where: { id: ids.candidate } });
    } finally { await db.$disconnect(); }
  });

  it("reproduces Prisma P2010 when a raw SELECT returns PostgreSQL void", async () => {
    const key = prefix + "-original";
    await expect(db.$transaction(tx => tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`))
      .rejects.toMatchObject({ code: "P2010", message: expect.stringMatching(/void/) });
  });

  it.each([false, true])("returns an integer and holds the lock until transaction end (rollback=%s)", async rollback => {
    const key = prefix + "-release-" + rollback;
    const work = db.$transaction(async tx => {
      await expect(tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`).resolves.toEqual([{ locked: 1 }]);
      // The outer client uses another real connection; the owner must still hold the lock.
      await expect(db.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`).resolves.toEqual([{ locked: false }]);
      if (rollback) throw new Error("QA deliberate rollback");
    });
    if (rollback) await expect(work).rejects.toThrow("QA deliberate rollback");
    else await work;
    await expect(db.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`).resolves.toEqual([{ locked: true }]);
  });

  it("executes custom-run before and after sending a scored solution without changing the score or exposing hidden data", async () => {
    const before = await customRun(request());
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({ output: "own output" });
    expect(await db.attemptAnswer.count({ where: { attemptId: ids.attempt } })).toBe(0);
    const submitted = await execute(request(true));
    expect(submitted.status).toBe(200);
    expect(JSON.stringify(await submitted.json())).not.toContain("SECRET_");
    const answer = await db.attemptAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: ids.attempt, questionId: ids.question } } });
    expect(answer).toMatchObject({ isCorrect: true, pointsEarned: 1 });
    expect(JSON.stringify(answer.executionResults)).toContain("SECRET_HIDDEN_INPUT");
    const after = await customRun(request());
    expect(after.status).toBe(200);
    expect(JSON.stringify(await after.json())).not.toContain("SECRET_");
    expect(await db.attemptAnswer.findUnique({ where: { id: answer.id } })).toEqual(answer);
    expect(await db.assessmentAttempt.findUnique({ where: { id: ids.attempt }, select: { status: true } })).toEqual({ status: "IN_PROGRESS" });
  });

  it("serializes real concurrent reservations and persists exactly 30 of 31 requests", async () => {
    const responses = await Promise.all(Array.from({ length: 31 }, () => customRun(request())));
    expect(responses.filter(response => response.status === 200)).toHaveLength(30);
    expect(responses.filter(response => response.status === 429)).toHaveLength(1);
    expect(await db.codeExecution.count({ where: { attemptId: ids.attempt } })).toBe(30);
    expect(mocks.executeCode).toHaveBeenCalledTimes(30);
  }, 20_000);

  it("rejects a finalized attempt without reserving or calling Judge0", async () => {
    await db.assessmentAttempt.update({ where: { id: ids.attempt }, data: { status: "SUBMITTED" } });
    expect((await customRun(request())).status).toBe(400);
    expect(await db.codeExecution.count({ where: { attemptId: ids.attempt } })).toBe(0);
    expect(mocks.executeCode).not.toHaveBeenCalled();
  });
});
