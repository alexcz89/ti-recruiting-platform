import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getAssessmentCost, getCurrentBillingCycle } from "@/lib/assessments/pricing";

const enabled = process.env.RUN_ATTEMPT_AUTH_DB_TESTS === "true";
function safeDatabase(value: string) {
  try {
    const u = new URL(value);
    return ["postgres:", "postgresql:"].includes(u.protocol) && u.hostname === "127.0.0.1" && u.port === "55435" &&
      u.pathname === "/taskio_custom_run_lock_qa" && u.username === "taskio_sql_qa";
  } catch { return false; }
}
if (enabled && (!safeDatabase(process.env.DATABASE_URL ?? "") || process.env.DIRECT_URL !== process.env.DATABASE_URL)) {
  throw new Error("Finalization SQL tests require the explicit disposable loopback database and matching DIRECT_URL.");
}
const database = enabled ? describe : describe.skip;
const mocks = vi.hoisted(() => ({ session: vi.fn(), notify: vi.fn(async () => undefined) }));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/server/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/service", () => ({ NotificationService: { create: mocks.notify } }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
type Pause = { match: (p: Prisma.MiddlewareParams) => boolean; entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> };
let pause: Pause | null = null;
let failCompanyUpdate = false;
function checkpoint(match: Pause["match"]) {
  const gate = { match, entered: deferred(), release: deferred() };
  pause = gate; return gate;
}
function rawSql(p: Prisma.MiddlewareParams): string {
  return Array.isArray(p.args) ? p.args[0].join("?") : String(p.args.query ?? "");
}
const rawInviteLock = (p: Prisma.MiddlewareParams) => p.action === "queryRaw" &&
  rawSql(p).includes('FROM "AssessmentInvite"') && !rawSql(p).includes('"AssessmentAttempt"');
const submitSnapshot = (p: Prisma.MiddlewareParams) => p.model === "AssessmentAttempt" && p.action === "findUnique" && Boolean(p.args.include?.answers);

let db: PrismaClient;
let key: string;
const id = (suffix: string) => key + "-" + suffix;
let submit: typeof import("@/app/api/assessments/attempts/[attemptId]/submit/route")["POST"];
let answer: typeof import("@/app/api/assessments/attempts/[attemptId]/answer/route")["POST"];
let flags: typeof import("@/app/api/assessments/attempts/[attemptId]/flags/route")["PATCH"];
let cancel: typeof import("@/lib/assessments/credits")["cancelInviteAndRefund"];
let refund: typeof import("@/lib/assessments/credits")["refundReservedCredits"];
let charge: typeof import("@/lib/assessments/credits")["chargeCompletionCredits"];
let reserve: typeof import("@/lib/assessments/credits")["reserveCredits"];
let start: typeof import("@/app/api/assessments/[templateId]/start/route")["POST"];
const params = () => ({ params: { attemptId: id("attempt") } });
function request(body: unknown = {}, ua = "QA client A") {
  return new Request("http://localhost/qa", { method: "POST", headers: { "content-type": "application/json", "user-agent": ua }, body: JSON.stringify(body) });
}
const send = () => submit(request(), params());
const save = () => answer(request({ questionId: id("mcq"), selectedOptions: ["correct"], timeSpent: 20 }), params());
const event = (ua?: string) => flags(request({ event: "TAB_SWITCH", eventId: randomUUID() }, ua), params());
async function waitForBlockedMutation() {
  const deadline = Date.now() + 4000;
  do {
    const [r] = await db.$queryRaw<Array<{ blocked: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_stat_activity a
        WHERE a.wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(a.pid)) > 0
        AND (a.query LIKE '%AssessmentAttempt%FOR UPDATE%' OR a.query LIKE '%AssessmentInvite%FOR UPDATE%')) AS blocked`;
    if (r.blocked) return;
    await new Promise(done => setTimeout(done, 15));
  } while (Date.now() < deadline);
  throw new Error("Expected a real PostgreSQL blocked mutation");
}
async function snapshot() {
  return {
    attempt: await db.assessmentAttempt.findUniqueOrThrow({ where: { id: id("attempt") }, include: { answers: { orderBy: { id: "asc" } }, events: true } }),
    invite: await db.assessmentInvite.findUniqueOrThrow({ where: { id: id("invite") } }),
    ledger: await db.assessmentInviteChargeLedger.findMany({ where: { inviteId: id("invite") } }),
    company: await db.company.findUniqueOrThrow({ where: { id: id("company") } }),
  };
}

database("P1 consistent scoring and atomic cancellation with real PostgreSQL (no SQL/Prisma mocks)", () => {
  beforeAll(async () => {
    db = (await import("@/lib/server/prisma")).prisma; await db.$connect();
    db.$use(async (p, next) => {
      if (failCompanyUpdate && p.model === "Company" && p.action === "update") {
        failCompanyUpdate = false; throw new Error("Synthetic failure after ledger update");
      }
      const result = await next(p); // Real queries always run, except deliberate rollback injection above.
      if (pause?.match(p)) { const gate = pause; pause = null; gate.entered.resolve(); await gate.release.promise; }
      return result;
    });
    submit = (await import("@/app/api/assessments/attempts/[attemptId]/submit/route")).POST;
    answer = (await import("@/app/api/assessments/attempts/[attemptId]/answer/route")).POST;
    flags = (await import("@/app/api/assessments/attempts/[attemptId]/flags/route")).PATCH;
    start = (await import("@/app/api/assessments/[templateId]/start/route")).POST;
    const credits = await import("@/lib/assessments/credits"); cancel = credits.cancelInviteAndRefund; refund = credits.refundReservedCredits;
    charge = credits.chargeCompletionCredits; reserve = credits.reserveCredits;
  });
  beforeEach(async () => {
    key = "qa-finalization-" + randomUUID(); pause = null; failCompanyUpdate = false; vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { id: id("candidate"), role: "CANDIDATE" } });
    await db.company.create({ data: { id: id("company"), name: "Synthetic P1 QA", assessmentCredits: 10, assessmentCreditsReserved: 1 } });
    await db.user.createMany({ data: [
      { id: id("candidate"), email: id("candidate") + "@example.invalid", role: "CANDIDATE" },
      { id: id("recruiter"), email: id("recruiter") + "@example.invalid", role: "RECRUITER" },
    ] });
    await db.job.create({ data: { id: id("job"), title: "Synthetic", description: "QA", location: "QA", employmentType: "FULL_TIME", companyId: id("company"), recruiterId: id("recruiter") } });
    await db.application.create({ data: { id: id("app"), jobId: id("job"), candidateId: id("candidate") } });
    await db.assessmentTemplate.create({ data: { id: id("template"), slug: key, title: "Synthetic", type: "MIXED", difficulty: "JUNIOR", totalQuestions: 2,
      passingScore: 50, timeLimit: 30, companyId: id("company"), isGlobal: false, sections: [{ name: "Fundamentos", minimumCorrect: 1 }, { name: "Código" }],
      questions: { create: [
        { id: id("mcq"), section: "Fundamentos", questionText: "Synthetic MCQ", difficulty: "JUNIOR", options: [
          { id: "correct", text: "A", isCorrect: true }, { id: "wrong", text: "B", isCorrect: false },
        ] },
        { id: id("coding"), section: "Código", questionText: "Synthetic coding", difficulty: "JUNIOR", type: "CODING", options: [], language: "python",
          testCases: { create: [{ input: "public", expectedOutput: "public", points: 10 }, { input: "private", expectedOutput: "private", isHidden: true, points: 30 }] } },
      ] },
    } });
    await db.assessmentInvite.create({ data: { id: id("invite"), token: id("token"), applicationId: id("app"), jobId: id("job"),
      candidateId: id("candidate"), templateId: id("template"), status: "STARTED" } });
    await db.assessmentAttempt.create({ data: { id: id("attempt"), applicationId: id("app"), candidateId: id("candidate"), templateId: id("template"), inviteId: id("invite"),
      status: "IN_PROGRESS", startedAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() + 3600000), flagsJson: { questionOrder: [id("mcq"), id("coding")] } } });
    await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("mcq"), selectedOptions: ["wrong"], isCorrect: false, pointsEarned: 0, timeSpent: 20 } });
    await db.assessmentInviteChargeLedger.create({ data: { inviteId: id("invite"), companyId: id("company"), cycle: getCurrentBillingCycle(), amount: 1, reservedAmount: 1,
      status: "RESERVED", assessmentType: "MIXED", difficulty: "JUNIOR" } });
  });
  afterEach(async () => {
    pause?.release.resolve(); pause = null; failCompanyUpdate = false;
    await db.assessmentAttempt.deleteMany({ where: { id: id("attempt") } });
    await db.assessmentInvite.deleteMany({ where: { id: id("invite") } });
    await db.assessmentTemplate.deleteMany({ where: { id: id("template") } });
    await db.job.deleteMany({ where: { id: id("job") } });
    await db.user.deleteMany({ where: { id: { in: [id("candidate"), id("recruiter")] } } });
    await db.company.deleteMany({ where: { id: id("company") } });
  });
  afterAll(async () => { if (db) await db.$disconnect(); });

  it("P1-A/A: Answer saves B first; Submit waits and grades exactly B", async () => {
    const gate = checkpoint(p => p.model === "AttemptAnswer" && p.action === "update");
    const saving = save(); await gate.entered.promise;
    const submitting = send();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await saving).status).toBe(200);
    const response = await submitting; expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalScore: 50, sectionScores: { Fundamentos: 100, Código: 0 }, passed: true });
    expect((await snapshot()).attempt).toMatchObject({ status: "SUBMITTED", totalScore: 50, passed: true,
      answers: [expect.objectContaining({ selectedOptions: ["correct"], pointsEarned: 1 })] });
  });
  it("P1-A/B: Submit locks its snapshot first; Answer waits and cannot replace A", async () => {
    const gate = checkpoint(submitSnapshot); const submitting = send(); await gate.entered.promise;
    const saving = save();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await submitting).status).toBe(200); expect((await saving).status).toBe(400);
    expect((await snapshot()).attempt).toMatchObject({ totalScore: 0, passed: false, answers: [expect.objectContaining({ selectedOptions: ["wrong"], pointsEarned: 0 })] });
  });
  it("P1-A/C: concurrent Submit closes/charges/notifies exactly once and returns the persisted result to the retry", async () => {
    await save(); const gate = checkpoint(submitSnapshot);
    const first = send(); await gate.entered.promise; const second = send();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    const responses = await Promise.all([first, second]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map(r => r.json()));
    expect(bodies[1]).toMatchObject({ alreadySubmitted: true, totalScore: bodies[0].totalScore, sectionScores: bodies[0].sectionScores, passed: bodies[0].passed });
    const after = await snapshot(); expect(after.invite.chargeCount).toBe(1); expect(after.ledger).toHaveLength(1); expect(after.ledger[0].status).toBe("CHARGED");
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it("P1-A/D: MIXED keeps equal question weights, partial coding credit, section minimums and passing threshold", async () => {
    await save();
    await db.attemptAnswer.create({ data: { attemptId: id("attempt"), questionId: id("coding"), selectedOptions: ["__CODE_SUBMITTED__"], pointsEarned: 0.5,
      codeSubmission: "historical synthetic code", passedTests: 1, totalTests: 2, timeSpent: 20 } });
    const response = await send(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalScore: 75, sectionScores: { Fundamentos: 100, Código: 50 }, passed: true, timeSpent: 40 });
  });
  it.each([false, true])("preserves grading of answers saved in time when submit is expired=%s", async expired => {
    await save();
    await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { expiresAt: expired ? new Date(0) : null } });
    const response = await send(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ expired, totalScore: 50, passed: true });
  });
  it.each(["submit", "answer", "flags"] as const)("P1-B cancellation wins before %s; no later active writes survive", async action => {
    const before = await snapshot(); const gate = checkpoint(rawInviteLock);
    const cancelling = cancel(id("invite")); await gate.entered.promise;
    const writing = action === "submit" ? send() : action === "answer" ? save() : event();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await cancelling).toEqual({ success: true }); expect((await writing).status).toBe(403);
    const after = await snapshot();
    expect(after.attempt).toEqual(before.attempt);
    expect(after.invite.status).toBe("CANCELLED"); expect(after.ledger[0].status).toBe("REFUNDED");
    expect(Number(after.company.assessmentCreditsReserved)).toBe(0); expect(Number(after.company.assessmentCredits)).toBe(10);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("P1-B/B: Submit wins; cancellation and cron refund observe the confirmed final state and keep the charge", async () => {
    await save(); const gate = checkpoint(submitSnapshot);
    const submitting = send(); await gate.entered.promise; const cancelling = cancel(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await submitting).status).toBe(200); expect(await cancelling).toMatchObject({ success: false });
    expect(await refund(id("invite"))).toMatchObject({ success: false });
    const after = await snapshot(); expect(after.attempt.status).toBe("SUBMITTED"); expect(after.invite.status).toBe("SUBMITTED");
    expect(after.invite.chargeCount).toBe(1); expect(after.ledger[0].status).toBe("CHARGED"); expect(Number(after.ledger[0].chargedAmount)).toBe(1);
    // Preserve current submit accounting rather than inventing a commercial adjustment.
    expect(Number(after.company.assessmentCreditsReserved)).toBe(1); expect(Number(after.company.assessmentCredits)).toBe(10);
  });
  it.each(["answer", "flags"] as const)("P1-B/F: %s can finish first, then cancellation completes without a lock cycle", async action => {
    const gate = checkpoint(p => p.action === "queryRaw" && rawSql(p).includes('FOR UPDATE OF i'));
    const writing = action === "answer" ? save() : event(); await gate.entered.promise;
    const cancelling = cancel(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await writing).status).toBe(200); expect(await cancelling).toEqual({ success: true });
    const after = await snapshot(); expect(after.invite.status).toBe("CANCELLED"); expect(after.ledger[0].status).toBe("REFUNDED");
    expect(action === "answer" ? after.attempt.answers[0].pointsEarned : after.attempt.events.length).toBe(1);
  });
  it("P1-B/E: concurrent and repeated cancellations decrement the reserve only once", async () => {
    const gate = checkpoint(rawInviteLock); const first = cancel(id("invite")); await gate.entered.promise;
    const second = cancel(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await Promise.all([first, second])).toEqual([{ success: true }, { success: true }]);
    const beforeRetry = await snapshot(); expect(await cancel(id("invite"))).toEqual({ success: true }); expect(await snapshot()).toEqual(beforeRetry);
    expect(beforeRetry.ledger).toHaveLength(1); expect(Number(beforeRetry.ledger[0].refundedAmount)).toBe(1); expect(Number(beforeRetry.company.assessmentCreditsReserved)).toBe(0);
  });
  it("rolls back the refund, company change and cancellation together when a write fails", async () => {
    const before = await snapshot(); failCompanyUpdate = true;
    expect(await cancel(id("invite"))).toMatchObject({ success: false }); expect(await snapshot()).toEqual(before);
  });
  it("all exported finance writers respect cancellation and cannot recreate or charge a cancelled reservation", async () => {
    const gate = checkpoint(rawInviteLock); const cancelling = cancel(id("invite")); await gate.entered.promise;
    const charging = charge(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await cancelling).toEqual({ success: true }); expect(await charging).toMatchObject({ success: false });
    const before = await snapshot();
    expect(await reserve(id("company"), id("invite"), "MIXED", "JUNIOR")).toMatchObject({ success: false });
    expect(await snapshot()).toEqual(before);
  });
  it("charge first is mutually exclusive with cancellation and repeated charge keeps the original pricing math", async () => {
    const pricing = getAssessmentCost("MIXED", "JUNIOR");
    const gate = checkpoint(rawInviteLock); const charging = charge(id("invite")); await gate.entered.promise;
    const cancelling = cancel(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await charging).toEqual({ success: true }); expect(await cancelling).toMatchObject({ success: false });
    const before = await snapshot();
    expect(before.ledger[0].status).toBe("CHARGED");
    expect(Number(before.company.assessmentCredits)).toBe(10 - pricing.total);
    expect(Number(before.company.assessmentCreditsReserved)).toBe(1 - pricing.reserve);
    expect(Number(before.company.assessmentCreditsUsed)).toBe(pricing.total);
    expect(await charge(id("invite"))).toMatchObject({ success: false }); expect(await snapshot()).toEqual(before);
  });
  it("also serializes cancellation with a legacy unlinked attempt's exact application tuple", async () => {
    await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { inviteId: null } });
    const gate = checkpoint(rawInviteLock); const cancelling = cancel(id("invite")); await gate.entered.promise;
    const saving = save();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await cancelling).toEqual({ success: true }); expect((await saving).status).toBe(403);
    expect((await snapshot()).attempt.answers[0].selectedOptions).toEqual(["wrong"]);
  });
  it("firstClientSig is chosen under the lock and a second client sets multiSession without overwriting it", async () => {
    const gate = checkpoint(p => p.model === "AssessmentAttempt" && p.action === "findUnique" && p.args.select?.firstClientSig === true && !p.args.select?.tabSwitches);
    const first = event("QA client A"); await gate.entered.promise; const second = event("QA client B");
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await first).status).toBe(200); expect((await second).status).toBe(200);
    const after = await snapshot(); expect(after.attempt.multiSession).toBe(true); expect(after.attempt.firstClientSig).not.toBe(after.attempt.lastClientSig);
    expect(after.attempt.tabSwitches).toBe(2); expect(after.attempt.events).toHaveLength(2);
  });

  it.each(["valid", "expired-invite", "expired-attempt", "no-deadline", "legacy"])(
    "refund preserves pending evidence and its reservation (%s)", async scenario => {
      await save();
      if (scenario === "expired-invite") {
        await db.assessmentInvite.update({ where: { id: id("invite") }, data: { expiresAt: new Date(0) } });
        await db.jobAssessment.create({ data: { jobId: id("job"), templateId: id("template") } });
      }
      if (scenario === "expired-attempt" || scenario === "no-deadline") {
        await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { expiresAt: scenario === "expired-attempt" ? new Date(0) : null } });
      }
      if (scenario === "legacy") {
        await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { inviteId: null } });
        // The effective legacy tuple remains protected even after invite.updatedAt advances.
        await db.assessmentInvite.update({ where: { id: id("invite") }, data: { expiresAt: new Date(0) } });
      }
      const before = await snapshot();
      expect(await refund(id("invite"))).toMatchObject({ success: false });
      expect(await snapshot()).toEqual(before);
      if (scenario === "expired-invite") {
        const response = await start(request({ token: id("token") }), { params: { templateId: id("template") } });
        expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ attemptId: id("attempt"), reused: true });
      }
      expect((await send()).status).toBe(200);
      const after = await snapshot(); expect(after.attempt.totalScore).toBe(50);
      expect(after.ledger[0].status).toBe("CHARGED"); expect(after.invite.chargeCount).toBe(1);
      expect(after.ledger.every(row => row.status !== "REFUNDED")).toBe(true);
    }
  );
  it("refund first against active Submit keeps RESERVED until Submit can charge exactly once", async () => {
    await save(); const before = await snapshot(); const gate = checkpoint(rawInviteLock);
    const refunding = refund(id("invite")); await gate.entered.promise; const submitting = send();
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await refunding).toMatchObject({ success: false }); expect((await submitting).status).toBe(200);
    const after = await snapshot(); expect(after.ledger).toHaveLength(1); expect(after.ledger[0].status).toBe("CHARGED");
    expect(Number(after.ledger[0].chargedAmount)).toBe(1); expect(after.invite.chargeCount).toBe(1);
    expect(after.company).toEqual(before.company);
    expect(await refund(id("invite"))).toMatchObject({ success: false });
    expect((await (await send()).json()).alreadySubmitted).toBe(true); expect(await snapshot()).toEqual(after);
  });
  it("Submit first against refund retains its confirmed charge and rejects repeated refund", async () => {
    await save(); const gate = checkpoint(submitSnapshot); const submitting = send(); await gate.entered.promise;
    const refunding = refund(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect((await submitting).status).toBe(200); expect(await refunding).toMatchObject({ success: false });
    const after = await snapshot(); expect(after.ledger).toHaveLength(1); expect(after.ledger[0].status).toBe("CHARGED");
    expect(after.invite.chargeCount).toBe(1); expect(await refund(id("invite"))).toMatchObject({ success: false });
    expect((await (await send()).json()).alreadySubmitted).toBe(true); expect(await snapshot()).toEqual(after);
  });
  it("confirmed refund of an unused invite closes it before any later start or Submit", async () => {
    await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { status: "NOT_STARTED", startedAt: null } });
    await db.assessmentInvite.update({ where: { id: id("invite") }, data: { status: "SENT" } });
    expect(await refund(id("invite"))).toEqual({ success: true });
    const after = await snapshot(); expect(after.invite.status).toBe("CANCELLED"); expect(after.invite.cancelledAt).not.toBeNull();
    expect(after.ledger[0].status).toBe("REFUNDED"); expect(Number(after.company.assessmentCreditsReserved)).toBe(0);
    expect(Number(after.company.assessmentCredits)).toBe(10); expect(Number(after.company.assessmentCreditsUsed)).toBe(0);
    const response = await start(request({ token: id("token") }), { params: { templateId: id("template") } });
    expect(response.status).toBe(410); expect((await send()).status).toBe(400);
    expect(await refund(id("invite"))).toMatchObject({ success: false }); expect(await snapshot()).toEqual(after);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("concurrent automatic refunds close an unused invite with one reserve release", async () => {
    await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { status: "NOT_STARTED", startedAt: null } });
    const gate = checkpoint(rawInviteLock); const first = refund(id("invite")); await gate.entered.promise;
    const second = refund(id("invite"));
    try { await waitForBlockedMutation(); } finally { gate.release.resolve(); }
    expect(await first).toEqual({ success: true }); expect(await second).toMatchObject({ success: false });
    const after = await snapshot(); expect(after.invite.status).toBe("CANCELLED"); expect(after.ledger).toHaveLength(1);
    expect(Number(after.ledger[0].refundedAmount)).toBe(1); expect(Number(after.company.assessmentCreditsReserved)).toBe(0);
    expect(Number(after.company.assessmentCredits)).toBe(10); expect(after.invite.chargeCount).toBe(0);
  });
  it("automatic refund failure rolls back both ledger release and invite closure", async () => {
    await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { status: "NOT_STARTED", startedAt: null } });
    const before = await snapshot(); failCompanyUpdate = true;
    expect(await refund(id("invite"))).toMatchObject({ success: false }); expect(await snapshot()).toEqual(before);
  });
  it.each([true, false])("the real seven-day cron preserves active=%s and closes only an unused invite", async active => {
    const old = new Date(Date.now() - 8 * 86400000);
    await db.assessmentInviteChargeLedger.updateMany({ where: { inviteId: id("invite") }, data: { cycle: 1, createdAt: old } });
    await db.assessmentInvite.update({ where: { id: id("invite") }, data: { status: active ? "STARTED" : "SENT", expiresAt: new Date(0) } });
    if (!active) await db.assessmentAttempt.update({ where: { id: id("attempt") }, data: { status: "NOT_STARTED", startedAt: null } });
    const before = await snapshot();
    const { refundUncompletedInvites } = await import("@/lib/server/cron/refund-uncompleted");
    const summary = await refundUncompletedInvites();
    if (active) {
      expect(summary).toEqual({ refunded: 0, failed: 1, totalAmount: 0 }); expect(await snapshot()).toEqual(before);
    } else {
      expect(summary).toEqual({ refunded: 1, failed: 0, totalAmount: 1 });
      const after = await snapshot(); expect(after.invite.status).toBe("CANCELLED"); expect(after.ledger[0].status).toBe("REFUNDED");
      expect(Number(after.company.assessmentCreditsReserved)).toBe(0); expect(Number(after.company.assessmentCredits)).toBe(10);
      expect(await refundUncompletedInvites()).toEqual({ refunded: 0, failed: 0, totalAmount: 0 }); expect(await snapshot()).toEqual(after);
    }
  });
});
