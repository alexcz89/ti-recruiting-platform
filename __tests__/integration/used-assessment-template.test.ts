import React from "react";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { assertAssessmentQuestionSnapshotTx, assertAssessmentTemplateEditableTx } from "@/lib/assessments/template-integrity";

const enabled = process.env.RUN_TEMPLATE_INTEGRITY_DB_TESTS === "true";
function isDisposable(value: string) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" &&
      url.port === "55435" && url.pathname === "/taskio_custom_run_lock_qa" && url.username === "taskio_sql_qa";
  } catch { return false; }
}
if (enabled && (!isDisposable(process.env.DATABASE_URL ?? "") || process.env.DIRECT_URL !== process.env.DATABASE_URL)) {
  throw new Error("Template integrity tests require the explicit disposable loopback database and matching DIRECT_URL.");
}
const database = enabled ? describe : describe.skip;
const auth = vi.hoisted(() => ({ session: vi.fn(), company: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: auth.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/server/session", () => ({ getSessionCompanyId: auth.company }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));

let db: PrismaClient;
let route: typeof import("@/app/api/dashboard/assessments/templates/[id]/route");
let start: typeof import("@/app/api/assessments/[templateId]/start/route")["POST"];
let admin: typeof import("@/app/dashboard/admin/templates/page")["default"];
let key: string;
const id = (name: string) => key + "-" + name;
function body() {
  return { title: "Edited", type: "MIXED", difficulty: "JUNIOR", language: "python", passingScore: 80, timeLimit: 40,
    questions: [{ type: "MULTIPLE_CHOICE", questionText: "Replacement", options: [{ id: "b", text: "B", isCorrect: true }] }] };
}
function put() {
  return route.PUT(new NextRequest("http://localhost/api/dashboard/assessments/templates/" + id("template"), {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body()),
  }), { params: { id: id("template") } });
}
function remove() {
  return route.DELETE(new NextRequest("http://localhost/api/dashboard/assessments/templates/" + id("template"), { method: "DELETE" }),
    { params: { id: id("template") } });
}
function inviteData() {
  return { id: id("invite"), token: id("token"), applicationId: id("application"), jobId: id("job"),
    candidateId: id("candidate"), templateId: id("template"), invitedById: id("recruiter") };
}
function attemptData() {
  return { id: id("attempt"), candidateId: id("candidate"), templateId: id("template") };
}
async function snapshot() {
  return {
    template: await db.assessmentTemplate.findUnique({ where: { id: id("template") }, include: { questions: { orderBy: { id: "asc" }, include: { testCases: true } } } }),
    attempts: await db.assessmentAttempt.findMany({ where: { templateId: id("template") }, include: { answers: true, codeExecutions: true } }),
    invites: await db.assessmentInvite.findMany({ where: { templateId: id("template") } }),
  };
}
async function expectConflict(response: Response) {
  expect(response.status).toBe(409);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ code: "ASSESSMENT_TEMPLATE_IN_USE", error: expect.any(String) });
}
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
let countGate: { read: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> } | null = null;
async function waitForBlockedBy(pid: number) {
  const deadline = Date.now() + 4000;
  do {
    const [row] = await db.$queryRaw<Array<{ blocked: boolean }>>
      `SELECT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE ${pid}::int = ANY(pg_blocking_pids(a.pid))) AS blocked`;
    if (row.blocked) return;
    await new Promise(done => setTimeout(done, 15));
  } while (Date.now() < deadline);
  throw new Error("Expected real PostgreSQL lock contention");
}
function findAction(node: React.ReactNode, prop: string): ((fd: FormData) => Promise<unknown>) | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<Record<string, unknown>>(child)) continue;
    if (typeof child.props[prop] === "function") return child.props[prop] as (fd: FormData) => Promise<unknown>;
    const action = findAction(child.props.children as React.ReactNode, prop);
    if (action) return action;
  }
}

database("used assessment templates with real PostgreSQL (no Prisma/SQL mocks)", () => {
  beforeAll(async () => {
    vi.stubGlobal("React", React);
    db = (await import("@/lib/server/prisma")).prisma;
    await db.$connect();
    db.$use(async (params, next) => {
      const result = await next(params); // Always execute the real Prisma/SQL operation.
      if (params.model === "AssessmentAttempt" && params.action === "count" && countGate) {
        const gate = countGate; countGate = null;
        gate.read.resolve(); await gate.release.promise;
      }
      return result;
    });
    route = await import("@/app/api/dashboard/assessments/templates/[id]/route");
    start = (await import("@/app/api/assessments/[templateId]/start/route")).POST;
    admin = (await import("@/app/dashboard/admin/templates/page")).default;
  });
  beforeEach(async () => {
    key = "qa-template-integrity-" + randomUUID();
    auth.session.mockResolvedValue({ user: { id: id("recruiter"), role: "RECRUITER" } });
    auth.company.mockResolvedValue(id("company"));
    await db.company.create({ data: { id: id("company"), name: "Synthetic template QA" } });
    await db.user.create({ data: { id: id("recruiter"), email: id("recruiter") + "@example.invalid", role: "RECRUITER",
      recruiterProfile: { create: { companyId: id("company"), companyName: "Synthetic template QA", status: "APPROVED" } } } });
    await db.user.create({ data: { id: id("candidate"), email: id("candidate") + "@example.invalid", role: "CANDIDATE" } });
    await db.job.create({ data: { id: id("job"), companyId: id("company"), recruiterId: id("recruiter"), title: "QA", location: "QA", employmentType: "FULL_TIME", description: "Synthetic" } });
    await db.application.create({ data: { id: id("application"), jobId: id("job"), candidateId: id("candidate") } });
    await db.assessmentTemplate.create({ data: { id: id("template"), slug: key, title: "Original", type: "MIXED", difficulty: "JUNIOR", totalQuestions: 2,
      passingScore: 70, timeLimit: 30, sections: [], language: "python", companyId: id("company"), isGlobal: false,
      questions: { create: [
        { id: id("mcq"), questionText: "Original MCQ", section: "General", difficulty: "JUNIOR", options: [{ id: "a", text: "A", isCorrect: true }] },
        { id: id("coding"), questionText: "Original coding", type: "CODING", section: "General", difficulty: "JUNIOR", options: [], language: "python", allowedLanguages: '["python"]',
          testCases: { create: [{ input: "secret", expectedOutput: "private", isHidden: true }] } },
      ] },
    } });
  });
  afterEach(async () => {
    countGate = null;
    vi.restoreAllMocks();
    if (!db || !key) return;
    await db.contest.deleteMany({ where: { id: id("contest") } });
    await db.assessmentAttempt.deleteMany({ where: { templateId: { in: [id("template"), id("evidence-template")] } } });
    await db.assessmentInvite.deleteMany({ where: { templateId: id("template") } });
    await db.jobAssessment.deleteMany({ where: { templateId: id("template") } });
    await db.assessmentTemplate.deleteMany({ where: { id: { in: [id("template"), id("evidence-template")] } } });
    await db.job.deleteMany({ where: { id: id("job") } });
    await db.user.deleteMany({ where: { id: { in: [id("recruiter"), id("candidate")] } } });
    await db.company.deleteMany({ where: { id: id("company") } });
  });
  afterAll(async () => { if (db) await db.$disconnect(); vi.unstubAllGlobals(); });

  it("retains the existing replacement behavior for a never-used template", async () => {
    expect((await put()).status).toBe(200);
    const after = await snapshot();
    expect(after.template).toMatchObject({ title: "Edited", passingScore: 80, timeLimit: 40, totalQuestions: 1 });
    expect(after.template?.questions).toHaveLength(1);
    expect(after.template?.questions[0].id).not.toBe(id("mcq"));
  });
  it("allows deactivating a never-used template without deleting its questions", async () => {
    expect((await remove()).status).toBe(200);
    expect((await snapshot()).template).toMatchObject({ isActive: false, questions: expect.arrayContaining([
      expect.objectContaining({ id: id("mcq") }), expect.objectContaining({ id: id("coding") }),
    ]) });
  });
  it("reproduces the destructive cascade that the endpoint must prevent", async () => {
    await db.assessmentAttempt.create({ data: attemptData() });
    await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("mcq"), selectedOptions: ["a"], pointsEarned: 1 } });
    await expect(db.$transaction(async tx => {
      await tx.assessmentQuestion.deleteMany({ where: { templateId: id("template") } });
      expect(await tx.attemptAnswer.count({ where: { attemptId: id("attempt") } })).toBe(0);
      throw new Error("rollback synthetic reproduction");
    })).rejects.toThrow("rollback synthetic reproduction");
    expect(await db.attemptAnswer.count({ where: { attemptId: id("attempt") } })).toBe(1);
  });
  it.each(["SENT", "STARTED", "CANCELLED", "COMPLETED"] as const)("protects an existing invite in state %s without partial writes", async status => {
    await db.assessmentInvite.create({ data: { ...inviteData(), status, expiresAt: new Date(0) } });
    const before = await snapshot();
    await expectConflict(await put());
    await expectConflict(await remove());
    expect(await snapshot()).toEqual(before);
  });
  it.each(["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "EVALUATED", "COMPLETED"] as const)("preserves IDs, evidence and scores for %s attempts even without an invite", async status => {
    await db.assessmentAttempt.create({ data: { ...attemptData(), status, totalScore: 75, passed: true, sectionScores: { General: 75 },
      startedAt: new Date(), expiresAt: new Date(Date.now() + 60000), flagsJson: { questionOrder: [id("mcq"), id("coding")], optionOrderByQuestion: {} } } });
    await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("mcq"), selectedOptions: ["a"], isCorrect: true, pointsEarned: 1 } });
    await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("coding"), selectedOptions: [],
      codeSubmission: "historical code", language: "python", isCorrect: true, pointsEarned: 1, passedTests: 1, totalTests: 1,
      executionResults: { private: "historical execution details" } } });
    await db.codeExecution.create({ data: { attemptId: id("attempt"), candidateId: id("candidate"), questionId: id("coding"), code: "synthetic", language: "python", status: "SUCCESS", output: "private" } });
    const before = await snapshot();
    await expectConflict(await put());
    await expectConflict(await remove());
    expect(await snapshot()).toEqual(before);
    if (status === "IN_PROGRESS") {
      auth.session.mockResolvedValue({ user: { id: id("candidate"), role: "CANDIDATE" } });
      const response = await start(new Request("http://localhost/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: id("attempt") }) }), { params: { templateId: id("template") } });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ reused: true, questions: expect.arrayContaining([expect.objectContaining({ id: id("mcq") }), expect.objectContaining({ id: id("coding") })]) });
    }
  });
  it("protects a job assignment before the first invitation", async () => {
    await db.jobAssessment.create({ data: { jobId: id("job"), templateId: id("template") } });
    const before = await snapshot();
    await expectConflict(await put());
    expect(await snapshot()).toEqual(before);
  });
  it("also protects historical question evidence with a legacy mismatched attempt/template link", async () => {
    await db.assessmentTemplate.create({ data: { id: id("evidence-template"), slug: key + "-evidence", title: "Legacy fixture", type: "MCQ",
      difficulty: "JUNIOR", totalQuestions: 1, passingScore: 70, timeLimit: 30, sections: [] } });
    await db.assessmentAttempt.create({ data: { ...attemptData(), templateId: id("evidence-template") } });
    const answer = await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("mcq"), selectedOptions: ["a"], pointsEarned: 1 } });
    const before = await snapshot();
    await expectConflict(await put());
    expect(await snapshot()).toEqual(before);
    expect(await db.attemptAnswer.findUnique({ where: { id: answer.id } })).toEqual(answer);
  });
  it("protects published badge exams and contest tracks before participation", async () => {
    await db.assessmentTemplate.update({ where: { id: id("template") }, data: { isBadgeExam: true } });
    await expectConflict(await put());
    await db.assessmentTemplate.update({ where: { id: id("template") }, data: { isBadgeExam: false } });
    await db.contest.create({ data: { id: id("contest"), slug: key, title: "Synthetic", description: "Synthetic", tracks: { create: { templateId: id("template"), language: "PYTHON" } } } });
    await expectConflict(await put());
  });
  it.each([false, true])("returns the same non-disclosing 404 for a foreign template (used=%s)", async used => {
    if (used) await db.assessmentAttempt.create({ data: attemptData() });
    auth.company.mockResolvedValue("another-company");
    const before = await snapshot();
    for (const response of [await put(), await remove()]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Template no encontrado o sin permisos" });
    }
    expect(await snapshot()).toEqual(before);
  });
  it.each([null, "CANDIDATE", "unapproved"])("retains authentication and approved recruiter restrictions: %s", async role => {
    auth.session.mockResolvedValue(role ? { user: { id: id("candidate"), role: role === "unapproved" ? "RECRUITER" : role } } : null);
    if (role === "unapproved") auth.company.mockResolvedValue(null);
    const before = await snapshot();
    expect((await put()).status).toBe(role ? 403 : 401);
    expect(await snapshot()).toEqual(before);
  });
  it("protects global templates even from authorized admins", async () => {
    auth.session.mockResolvedValue({ user: { id: id("recruiter"), role: "ADMIN" } });
    await db.assessmentTemplate.update({ where: { id: id("template") }, data: { isGlobal: true } });
    expect((await put()).status).toBe(200);
    await db.assessmentAttempt.create({ data: attemptData() });
    await expectConflict(await put());
  });
  it.each(["onDeactivate", "onToggleGlobal", "action"])("admin action %s cannot evade the protection", async prop => {
    auth.session.mockResolvedValue({ user: { id: id("recruiter"), role: "ADMIN" } });
    await db.assessmentTemplate.update({ where: { id: id("template") }, data: { isGlobal: true } });
    await db.assessmentAttempt.create({ data: attemptData() });
    const before = await snapshot();
    const action = findAction(await admin(), prop);
    expect(action).toBeTypeOf("function");
    const form = new FormData(); form.set("templateId", id("template")); form.set("remove", "true"); form.set("isGlobal", "false");
    expect(await action!(form)).toMatchObject({ code: "ASSESSMENT_TEMPLATE_IN_USE", error: expect.any(String) });
    expect(await snapshot()).toEqual(before);
  });
  it.each(["invite", "attempt", "assignment", "contest"])("waits for an in-flight %s FK insert and then rejects the edit", async relation => {
    if (relation === "contest") await db.contest.create({ data: { id: id("contest"), slug: key, title: "QA", description: "Synthetic" } });
    const inserted = deferred<number>(); const release = deferred();
    const writer = db.$transaction(async tx => {
      if (relation === "invite") await tx.assessmentInvite.create({ data: inviteData() });
      else if (relation === "attempt") await tx.assessmentAttempt.create({ data: attemptData() });
      else if (relation === "assignment") await tx.jobAssessment.create({ data: { jobId: id("job"), templateId: id("template") } });
      else await tx.contestTrack.create({ data: { contestId: id("contest"), templateId: id("template"), language: "PYTHON" } });
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      inserted.resolve(row.pid); await release.promise;
    }, { timeout: 10000 });
    const pid = await inserted.promise;
    const editing = put();
    try { await waitForBlockedBy(pid); } finally { release.resolve(); }
    await writer;
    await expectConflict(await editing);
    expect(await db.assessmentQuestion.count({ where: { id: { in: [id("mcq"), id("coding")] } } })).toBe(2);
  });
  it.each(["invite", "attempt", "assignment", "contest"])("an edit that locks first blocks the %s FK until its commit", async relation => {
    if (relation === "contest") await db.contest.create({ data: { id: id("contest"), slug: key, title: "QA", description: "Synthetic" } });
    const locked = deferred<number>(); const release = deferred();
    const editor = db.$transaction(async tx => {
      await assertAssessmentTemplateEditableTx(tx, id("template"), { companyId: id("company"), isGlobal: false });
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(row.pid); await release.promise;
      await tx.assessmentQuestion.deleteMany({ where: { templateId: id("template") } });
      await tx.assessmentQuestion.create({ data: { templateId: id("template"), questionText: "New", section: "General", difficulty: "JUNIOR", options: [] } });
    }, { isolationLevel: "ReadCommitted", timeout: 10000 });
    const pid = await locked.promise;
    const writer = relation === "invite" ? db.assessmentInvite.create({ data: inviteData() })
      : relation === "attempt" ? db.assessmentAttempt.create({ data: attemptData() })
      : relation === "assignment" ? db.jobAssessment.create({ data: { jobId: id("job"), templateId: id("template") } })
      : db.contestTrack.create({ data: { contestId: id("contest"), templateId: id("template"), language: "PYTHON" } });
    const writing = Promise.resolve(writer);
    try { await waitForBlockedBy(pid); } finally { release.resolve(); }
    await editor; await writing;
    await expectConflict(await put());
    expect((await snapshot()).template?.questions).toMatchObject([{ questionText: "New" }]);
  });
  it("rejects a stale question snapshot after a concurrent edit commits, before creating an attempt", async () => {
    const oldIds = [id("mcq"), id("coding")];
    expect((await put()).status).toBe(200);
    await expect(db.$transaction(async tx => {
      await assertAssessmentQuestionSnapshotTx(tx, id("template"), oldIds);
      await tx.assessmentAttempt.create({ data: { ...attemptData(), flagsJson: { questionOrder: oldIds } } });
    })).rejects.toMatchObject({ code: "ASSESSMENT_TEMPLATE_CHANGED" });
    expect(await db.assessmentAttempt.count({ where: { templateId: id("template") } })).toBe(0);
  });
  it("returns 409 from the real start route if its job context is unlinked and edited after it read the questions", async () => {
    await db.jobAssessment.create({ data: { jobId: id("job"), templateId: id("template") } });
    auth.session.mockResolvedValue({ user: { id: id("candidate"), role: "CANDIDATE" } });
    const read = deferred(); const release = deferred();
    // Pause after the real count: the route has already read questions and checked the job.
    countGate = { read, release };
    const starting = start(new Request("http://localhost/start", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: id("application") }) }), { params: { templateId: id("template") } });
    try {
      await Promise.race([read.promise, starting.then(() => { throw new Error("Start returned before the real SQL count"); })]);
      await db.jobAssessment.deleteMany({ where: { templateId: id("template") } });
      auth.session.mockResolvedValue({ user: { id: id("recruiter"), role: "RECRUITER" } });
      expect((await put()).status).toBe(200);
    } finally { countGate = null; release.resolve(); }
    const response = await starting;
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ASSESSMENT_TEMPLATE_CHANGED" });
    expect(await db.assessmentAttempt.count({ where: { templateId: id("template") } })).toBe(0);
  });
  it("keeps a validated question snapshot locked until the new attempt is persisted", async () => {
    const locked = deferred<number>(); const release = deferred();
    const starter = db.$transaction(async tx => {
      const questionOrder = [id("mcq"), id("coding")];
      await assertAssessmentQuestionSnapshotTx(tx, id("template"), questionOrder);
      const [row] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      locked.resolve(row.pid); await release.promise;
      await tx.assessmentAttempt.create({ data: { ...attemptData(), flagsJson: { questionOrder } } });
    }, { timeout: 10000 });
    const pid = await locked.promise;
    const editing = put();
    try { await waitForBlockedBy(pid); } finally { release.resolve(); }
    await starter; await expectConflict(await editing);
    expect((await snapshot()).attempts[0].flagsJson).toMatchObject({ questionOrder: [id("mcq"), id("coding")] });
  });
});
