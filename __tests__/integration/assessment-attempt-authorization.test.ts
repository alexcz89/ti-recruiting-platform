import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_ATTEMPT_AUTH_DB_TESTS === "true";
function safeDatabase(value: string) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" && url.port === "55435" &&
      url.pathname === "/taskio_custom_run_lock_qa" && url.username === "taskio_sql_qa";
  } catch { return false; }
}
if (enabled && (!safeDatabase(process.env.DATABASE_URL ?? "") || process.env.DIRECT_URL !== process.env.DATABASE_URL)) {
  throw new Error("Attempt authorization tests require the explicit disposable loopback database and matching DIRECT_URL.");
}
const database = enabled ? describe : describe.skip;
const mocks = vi.hoisted(() => ({ session: vi.fn(), execute: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/service", () => ({ NotificationService: { create: vi.fn() } }));
vi.mock("@/lib/code-execution/plagiarism", () => ({ checkPlagiarism: vi.fn(async () => undefined) }));
vi.mock("@/lib/code-execution/judge0-service", () => ({ judge0Service: {
  executeCode: mocks.execute, isLanguageSupported: () => true, getSupportedLanguages: () => ["python"], getStarterCode: () => "# TODO",
} }));

const key = "qa-attempt-auth-" + randomUUID();
const id = (suffix: string) => key + "-" + suffix;
let db: PrismaClient;
let routes: {
  state: typeof import("@/app/api/assessments/attempts/[attemptId]/state/route")["GET"];
  results: typeof import("@/app/api/assessments/attempts/[attemptId]/results/route")["GET"];
  detail: typeof import("@/app/api/assessments/[templateId]/route")["GET"];
  start: typeof import("@/app/api/assessments/[templateId]/start/route")["POST"];
  answer: typeof import("@/app/api/assessments/attempts/[attemptId]/answer/route")["POST"];
  flags: typeof import("@/app/api/assessments/attempts/[attemptId]/flags/route")["PATCH"];
  submit: typeof import("@/app/api/assessments/attempts/[attemptId]/submit/route")["POST"];
  execute: typeof import("@/app/api/assessments/code/execute/route")["POST"];
  custom: typeof import("@/app/api/assessments/code/custom-run/route")["POST"];
};
function actor(role = "CANDIDATE", suffix = "candidate-a") {
  mocks.session.mockResolvedValue({ user: { id: id(suffix), role } });
}
const params = (suffix = "attempt-a") => ({ params: { attemptId: id(suffix) } });
function request(body?: unknown) {
  return new Request("http://localhost/api/test", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function coding(question = "coding-a", attempt = "attempt-a", isSubmission = false) {
  return request({ attemptId: id(attempt), questionId: id(question), code: "synthetic candidate program", language: "python", customInput: "own input", isSubmission });
}
async function evidence() {
  return {
    attempts: await db.assessmentAttempt.findMany({ where: { id: { startsWith: key } }, orderBy: { id: "asc" } }),
    answers: await db.attemptAnswer.findMany({ where: { attemptId: { startsWith: key } }, orderBy: { id: "asc" } }),
    executions: await db.codeExecution.findMany({ where: { attemptId: { startsWith: key } }, orderBy: { id: "asc" } }),
    events: await db.assessmentAttemptEvent.findMany({ where: { attemptId: { startsWith: key } }, orderBy: { id: "asc" } }),
  };
}
async function rejectedWithoutWrites(run: () => Promise<Response>, status?: number) {
  const before = await evidence();
  const calls = mocks.execute.mock.calls.length;
  const response = await run();
  expect(response.status).toBe(status ?? 403);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await evidence()).toEqual(before);
  expect(mocks.execute).toHaveBeenCalledTimes(calls);
  return response;
}

database("assessment attempt authorization with real PostgreSQL and approved recruiter profiles", () => {
  beforeAll(async () => {
    db = (await import("@/lib/server/prisma")).prisma; await db.$connect();
    routes = {
      state: (await import("@/app/api/assessments/attempts/[attemptId]/state/route")).GET,
      results: (await import("@/app/api/assessments/attempts/[attemptId]/results/route")).GET,
      detail: (await import("@/app/api/assessments/[templateId]/route")).GET,
      start: (await import("@/app/api/assessments/[templateId]/start/route")).POST,
      answer: (await import("@/app/api/assessments/attempts/[attemptId]/answer/route")).POST,
      flags: (await import("@/app/api/assessments/attempts/[attemptId]/flags/route")).PATCH,
      submit: (await import("@/app/api/assessments/attempts/[attemptId]/submit/route")).POST,
      execute: (await import("@/app/api/assessments/code/execute/route")).POST,
      custom: (await import("@/app/api/assessments/code/custom-run/route")).POST,
    };
    for (const side of ["a", "b"]) {
      await db.company.create({ data: { id: id("company-" + side), name: "Synthetic " + side } });
      await db.user.create({ data: { id: id("recruiter-" + side), role: "RECRUITER", email: id("recruiter-" + side) + "@example.invalid",
        recruiterProfile: { create: { companyId: id("company-" + side), companyName: "Synthetic", status: "APPROVED" } } } });
      await db.user.create({ data: { id: id("candidate-" + side), role: "CANDIDATE", email: id("candidate-" + side) + "@example.invalid" } });
      await db.job.create({ data: { id: id("job-" + side), companyId: id("company-" + side), title: "Synthetic", location: "QA", employmentType: "FULL_TIME", description: "Synthetic" } });
      await db.application.create({ data: { id: id("app-" + side), candidateId: id("candidate-" + side), jobId: id("job-" + side) } });
      await db.assessmentTemplate.create({ data: { id: id("template-" + side), slug: id("template-" + side), companyId: id("company-" + side), isGlobal: false,
        title: "PRIVATE_TEMPLATE_" + side, type: "MIXED", difficulty: "JUNIOR", timeLimit: 30, passingScore: 70, totalQuestions: 2, sections: [],
        questions: { create: [
          { id: id("mcq-" + side), section: "General", questionText: "Synthetic MCQ", difficulty: "JUNIOR", options: [{ id: "a", text: "A", isCorrect: true }] },
          { id: id("coding-" + side), section: "General", questionText: "Synthetic coding", difficulty: "JUNIOR", options: [], type: "CODING", language: "python", allowedLanguages: '["python"]',
            testCases: { create: [{ input: "public", expectedOutput: "public", isHidden: false }, { input: "SECRET_INPUT", expectedOutput: "SECRET_OUTPUT", isHidden: true }] } },
          { id: id("outside-" + side), section: "General", questionText: "Outside sampled attempt", difficulty: "JUNIOR", options: [], type: "CODING", language: "python",
            testCases: { create: [{ input: "unauthorized", expectedOutput: "unauthorized", isHidden: false }] } },
        ] },
      } });
      await db.jobAssessment.create({ data: { jobId: id("job-" + side), templateId: id("template-" + side) } });
      await db.assessmentInvite.create({ data: { id: id("invite-" + side), token: id("token-" + side), candidateId: id("candidate-" + side),
        jobId: id("job-" + side), applicationId: id("app-" + side), templateId: id("template-" + side), status: "STARTED" } });
      await db.assessmentAttempt.create({ data: { id: id("attempt-" + side), candidateId: id("candidate-" + side), templateId: id("template-" + side),
        applicationId: id("app-" + side), inviteId: id("invite-" + side), status: "IN_PROGRESS", startedAt: new Date(), expiresAt: new Date(Date.now() + 3600000),
        flagsJson: { questionOrder: [id("mcq-" + side), id("coding-" + side)], optionOrderByQuestion: {} } } });
    }
  }, 20000);
  beforeEach(async () => {
    actor(); vi.clearAllMocks();
    await db.contestRegistration.deleteMany({ where: { id: id("registration") } });
    await db.contest.deleteMany({ where: { id: id("contest") } });
    await db.codeExecution.deleteMany({ where: { attemptId: { startsWith: key } } });
    await db.attemptAnswer.deleteMany({ where: { attemptId: { startsWith: key } } });
    await db.assessmentAttemptEvent.deleteMany({ where: { attemptId: { startsWith: key } } });
    await db.assessmentAttempt.updateMany({ where: { id: { startsWith: key } }, data: { status: "IN_PROGRESS", expiresAt: new Date(Date.now() + 3600000) } });
    await db.assessmentInvite.updateMany({ where: { id: { startsWith: key } }, data: { status: "STARTED", expiresAt: new Date(Date.now() + 3600000) } });
    mocks.execute.mockImplementation(async ({ testCases }: { testCases: Array<{ id: string; input: string; expectedOutput: string }> }) => ({
      success: true, status: "SUCCESS", output: "SECRET_AGGREGATED_OUTPUT", testResults: testCases.map(test => ({
        testCaseId: test.id, input: test.input, expectedOutput: test.expectedOutput, actualOutput: test.expectedOutput, passed: true, errorSource: "program",
      })),
    }));
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.contestRegistration.deleteMany({ where: { id: id("registration") } });
      await db.contest.deleteMany({ where: { id: id("contest") } });
      await db.assessmentAttempt.deleteMany({ where: { id: { startsWith: key } } });
      await db.assessmentInvite.deleteMany({ where: { id: { startsWith: key } } });
      await db.assessmentTemplate.deleteMany({ where: { id: { startsWith: key } } });
      await db.job.deleteMany({ where: { id: { startsWith: key } } });
      await db.user.deleteMany({ where: { id: { startsWith: key } } });
      await db.company.deleteMany({ where: { id: { startsWith: key } } });
    } finally { await db.$disconnect(); }
  });
  it("allows an owner to read their state while denying another candidate's state", async () => {
    expect((await routes.state(request(), params())).status).toBe(200);
    await rejectedWithoutWrites(() => routes.state(request(), params("attempt-b")));
  });
  it.each(["answer", "execute", "custom", "submit"] as const)("rejects foreign %s without side effects", async action => {
    await rejectedWithoutWrites(() => action === "answer" ? routes.answer(request({ questionId: id("mcq-b"), selectedOptions: ["a"] }), params("attempt-b"))
      : action === "execute" ? routes.execute(coding("coding-b", "attempt-b", true)) : action === "custom" ? routes.custom(coding("coding-b", "attempt-b"))
      : routes.submit(request({}), params("attempt-b")));
  });
  it.each(["execute", "custom"] as const)("rejects %s on a question in the template but outside questionOrder", async action => {
    await rejectedWithoutWrites(() => routes[action](coding("outside-a")), 404);
  });
  it("derives ownership and grading from the server, ignoring client identity and score fields", async () => {
    const response = await routes.answer(request({ questionId: id("mcq-a"), selectedOptions: ["a"], candidateId: id("candidate-b"),
      attemptId: id("attempt-b"), isCorrect: false, pointsEarned: 999, totalScore: 999 }), params());
    expect(response.status).toBe(200);
    expect(await db.attemptAnswer.findUnique({ where: { attemptId_questionId: { attemptId: id("attempt-a"), questionId: id("mcq-a") } } }))
      .toMatchObject({ isCorrect: true, pointsEarned: 1 });
    expect(await db.attemptAnswer.count({ where: { attemptId: id("attempt-b") } })).toBe(0);
  });
  it("does not disclose private template metadata without authorized context or with an invalid token", async () => {
    for (const query of ["", "?token=invalid", "?attemptId=" + id("attempt-b")]) {
      const response = await routes.detail(new Request("http://localhost/detail" + query), { params: { templateId: id("template-b") } });
      expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain("PRIVATE_TEMPLATE");
    }
  });
  it("does not grant metadata access through a historical cross-tenant JobAssessment link", async () => {
    const link = await db.jobAssessment.create({ data: { jobId: id("job-a"), templateId: id("template-b") } });
    try {
      const response = await routes.detail(request(), { params: { templateId: id("template-b") } });
      expect(response.status).toBe(404);
      expect(JSON.stringify(await response.json())).not.toContain("PRIVATE_TEMPLATE");
      await rejectedWithoutWrites(() => routes.start(request({ applicationId: id("app-a") }), { params: { templateId: id("template-b") } }), 404);
    } finally { await db.jobAssessment.delete({ where: { id: link.id } }); }
  });
  it.each(["IN_PROGRESS", "SUBMITTED"] as const)("does not reveal a foreign attempt's %s state through results", async status => {
    await db.assessmentAttempt.update({ where: { id: id("attempt-b") }, data: { status } });
    await rejectedWithoutWrites(() => routes.results(request(), params("attempt-b")), 404);
  });
  it("uses real approved company membership for recruiter results and preserves candidate summary-only access", async () => {
    await db.assessmentAttempt.updateMany({ where: { id: { startsWith: key } }, data: { status: "SUBMITTED", totalScore: 80 } });
    actor("RECRUITER", "recruiter-a");
    await rejectedWithoutWrites(() => routes.results(request(), params("attempt-b")), 404);
    expect((await routes.results(request(), params())).status).toBe(200);
    actor();
    const own = await routes.results(request(), params()); expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ summaryOnly: true, answers: [] });
    actor("ADMIN", "recruiter-a"); expect((await routes.results(request(), params("attempt-b"))).status).toBe(200);
  });
  it("denies a recruiter whose real profile is no longer approved", async () => {
    await db.recruiterProfile.update({ where: { userId: id("recruiter-a") }, data: { status: "PENDING" } });
    actor("RECRUITER", "recruiter-a");
    try { await rejectedWithoutWrites(() => routes.results(request(), params()), 404); }
    finally { await db.recruiterProfile.update({ where: { userId: id("recruiter-a") }, data: { status: "APPROVED" } }); }
  });
  it.each(["execute", "custom"] as const)("fails closed for %s with a missing sampled order", async action => {
    await db.assessmentAttempt.update({ where: { id: id("attempt-a") }, data: { flagsJson: { sampled: true } } });
    try { await rejectedWithoutWrites(() => routes[action](coding()), 404); }
    finally { await db.assessmentAttempt.update({ where: { id: id("attempt-a") }, data: { flagsJson: {
      questionOrder: [id("mcq-a"), id("coding-a")], optionOrderByQuestion: {},
    } } }); }
  });
  it.each(["answer", "execute", "custom", "flags", "submit"] as const)("does not let staff perform candidate-only %s writes", async action => {
    for (const role of ["RECRUITER", "ADMIN"]) {
      actor(role, "recruiter-a");
      await rejectedWithoutWrites(() => action === "answer" ? routes.answer(request({ questionId: id("mcq-a"), selectedOptions: ["a"] }), params())
        : action === "flags" ? routes.flags(request({ event: "TAB_SWITCH" }), params())
        : action === "submit" ? routes.submit(request({}), params()) : routes[action](coding()));
    }
  });
  it.each(["answer", "execute", "custom", "flags", "submit", "start"] as const)("rejects %s on a cancelled invite even with an active attempt", async action => {
    await db.assessmentInvite.update({ where: { id: id("invite-a") }, data: { status: "CANCELLED" } });
    await rejectedWithoutWrites(() => action === "answer" ? routes.answer(request({ questionId: id("mcq-a"), selectedOptions: ["a"] }), params())
      : action === "flags" ? routes.flags(request({ event: "TAB_SWITCH" }), params())
      : action === "submit" ? routes.submit(request({}), params())
      : action === "start" ? routes.start(request({ attemptId: id("attempt-a") }), { params: { templateId: id("template-a") } })
      : routes[action](coding()), 403);
  });
  it("does not let an applicationId-only start bypass a cancelled invitation", async () => {
    await db.assessmentInvite.update({ where: { id: id("invite-a") }, data: { status: "CANCELLED" } });
    await rejectedWithoutWrites(() => routes.start(request({ applicationId: id("app-a") }), { params: { templateId: id("template-a") } }), 410);
  });
  it.each(["answer", "execute", "custom"] as const)("rejects %s after submission or expiration without modifying evidence", async action => {
    for (const expired of [false, true]) {
      await db.assessmentAttempt.update({ where: { id: id("attempt-a") }, data: { status: expired ? "IN_PROGRESS" : "SUBMITTED", expiresAt: expired ? new Date(0) : null } });
      await rejectedWithoutWrites(() => action === "answer" ? routes.answer(request({ questionId: id("mcq-a"), selectedOptions: ["a"] }), params()) : routes[action](coding()), expired ? 410 : 400);
    }
  });
  it.each(["execute", "custom"] as const)("rejects %s after the contest window closes", async action => {
    await db.contest.create({ data: { id: id("contest"), slug: key, title: "Synthetic", description: "QA", status: "COMPLETED",
      tracks: { create: { id: id("track"), templateId: id("template-a"), language: "PYTHON" } } } });
    await db.contestRegistration.create({ data: { id: id("registration"), contestId: id("contest"), trackId: id("track"), candidateId: id("candidate-a"),
      attemptId: id("attempt-a"), city: "QA", experienceLevel: "JUNIOR", linkedinUrl: "https://example.invalid/qa" } });
    await rejectedWithoutWrites(() => routes[action](coding()));
  });
  it.each(["answer", "flags"] as const)("serializes %s with a concurrent finalization and rejects without partial writes", async action => {
    let ready!: (pid: number) => void; let release!: () => void;
    const locked = new Promise<number>(done => { ready = done; });
    const gate = new Promise<void>(done => { release = done; });
    const finalizing = db.$transaction(async tx => {
      await tx.assessmentAttempt.update({ where: { id: id("attempt-a") }, data: { status: "SUBMITTED" } });
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      ready(row.pid); await gate;
    }, { timeout: 10000 });
    const pid = await locked;
    const writing = action === "answer" ? routes.answer(request({ questionId: id("mcq-a"), selectedOptions: ["a"] }), params())
      : routes.flags(request({ event: "TAB_SWITCH" }), params());
    try {
      const deadline = Date.now() + 4000;
      let blocked = false;
      do {
        const [row] = await db.$queryRaw<Array<{ blocked: boolean }>>
          `SELECT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE ${pid}::int = ANY(pg_blocking_pids(a.pid))) AS blocked`;
        blocked = row.blocked;
        if (!blocked) await new Promise(done => setTimeout(done, 15));
      } while (!blocked && Date.now() < deadline);
      expect(blocked).toBe(true);
    } finally { release(); await finalizing; }
    expect((await writing).status).toBe(400);
    expect(await db.attemptAnswer.count({ where: { attemptId: id("attempt-a") } })).toBe(0);
    expect(await db.assessmentAttemptEvent.count({ where: { attemptId: id("attempt-a") } })).toBe(0);
  });
  it("preserves legitimate public runs, scored submissions and custom runs without hidden data in HTTP", async () => {
    for (const response of [await routes.execute(coding()), await routes.execute(coding("coding-a", "attempt-a", true)), await routes.custom(coding())]) {
      expect(response.status).toBe(200); expect(JSON.stringify(await response.json())).not.toContain("SECRET_");
    }
    expect(await db.attemptAnswer.count({ where: { attemptId: id("attempt-a") } })).toBe(1);
  });
  it("keeps token ownership and expiry checks while preserving active resume after invitation expiry", async () => {
    const good = await routes.start(request({ token: id("token-a") }), { params: { templateId: id("template-a") } });
    expect(good.status).toBe(200);
    await db.assessmentInvite.update({ where: { id: id("invite-a") }, data: { expiresAt: new Date(0) } });
    expect((await routes.start(request({ token: id("token-a") }), { params: { templateId: id("template-a") } })).status).toBe(200);
    expect((await routes.start(request({ token: "invalid" }), { params: { templateId: id("template-a") } })).status).toBe(400);
    expect((await routes.start(request({ token: id("token-b") }), { params: { templateId: id("template-b") } })).status).toBe(403);
  });
  it("rejects an expired invitation when no authorized active attempt exists", async () => {
    await db.user.create({ data: { id: id("candidate-new"), email: id("candidate-new") + "@example.invalid", role: "CANDIDATE" } });
    await db.application.create({ data: { id: id("app-new"), jobId: id("job-a"), candidateId: id("candidate-new") } });
    await db.assessmentInvite.create({ data: { id: id("invite-new"), token: id("token-new"), candidateId: id("candidate-new"), jobId: id("job-a"),
      applicationId: id("app-new"), templateId: id("template-a"), status: "SENT", expiresAt: new Date(0) } });
    actor("CANDIDATE", "candidate-new");
    await rejectedWithoutWrites(() => routes.start(request({ token: id("token-new") }), { params: { templateId: id("template-a") } }), 410);
    await rejectedWithoutWrites(() => routes.start(request({ applicationId: id("app-new") }), { params: { templateId: id("template-a") } }), 410);
  });
  it.each(["state", "results", "execute", "custom"] as const)("requires authentication for %s", async action => {
    mocks.session.mockResolvedValue(null);
    await rejectedWithoutWrites(() => action === "state" || action === "results" ? routes[action](request(), params()) : routes[action](coding()), 401);
  });
});
