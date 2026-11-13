import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createInterviewBlueprintService } from "@/lib/ai/ai-interview-blueprint-service";
import { createPrismaInterviewBlueprintStore } from "@/lib/ai/prisma-ai-interview-blueprint-store";
import { createPrismaInterviewInvitationStore } from "@/lib/ai/prisma-ai-interview-invitation-store";
import { createInterviewInvitationService } from "@/lib/ai/ai-interview-invitation-service";
import { createCandidateInterviewService } from "@/lib/ai/ai-interview-candidate-service";
import { createInterviewSessionService } from "@/lib/ai/ai-interview-session-service";
import { createPrismaInterviewStore } from "@/lib/ai/prisma-ai-interview-session-store";

const enabled = process.env.RUN_AI_INTERVIEW_DB_TESTS === "true";
const url = process.env.AI_INTERVIEW_TEST_DATABASE_URL ?? "";
if (enabled) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/taskio_ai_interview_test" || parsed.searchParams.has("host")) throw new Error("Disposable loopback interview database required");
}
const prefix = `qa-invite-${randomUUID()}`;
const scope = { actorId: prefix + "-r", companyId: prefix + "-a", candidateId: prefix + "-c", applicationId: prefix };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["SECRET_RUBRIC"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
const start = { type: "START_INTERVIEW", commandId: "start" };
let db: PrismaClient; let second: PrismaClient; let approvedId: string;
let recruiter: ReturnType<typeof createInterviewInvitationService>;
let candidate: ReturnType<typeof createCandidateInterviewService>;
let otherCandidate: ReturnType<typeof createCandidateInterviewService>;
async function args(requestId = randomUUID()) {
  const [row] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return { blueprintVersionId: approvedId, requestId, expiresAt: row.now.getTime() + 3_600_000 };
}
async function issue() { return recruiter.issue(scope, await args()); }
async function count() {
  const [row] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "AIInterviewSession" WHERE "companyId" = ${scope.companyId}`;
  return row.n;
}
describe.skipIf(!enabled)("candidate interview invitations with real PostgreSQL (provision locally first)", () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } }); second = new PrismaClient({ datasources: { db: { url } } });
    recruiter = createInterviewInvitationService(createPrismaInterviewInvitationStore(db));
    candidate = createCandidateInterviewService(createPrismaInterviewInvitationStore(db), async () => scope.candidateId);
    otherCandidate = createCandidateInterviewService(createPrismaInterviewInvitationStore(second), async () => scope.candidateId);
    await db.company.createMany({ data: [{ id: scope.companyId, name: "Synthetic A" }, { id: prefix + "-b", name: "Synthetic B" }] });
    await db.user.createMany({ data: [
      { id: scope.actorId, email: prefix + "-r@example.invalid", role: "RECRUITER" },
      { id: scope.candidateId, email: prefix + "-c@example.invalid", role: "CANDIDATE" },
      { id: prefix + "-other", email: prefix + "-other@example.invalid", role: "CANDIDATE" },
      { id: prefix + "-admin", email: prefix + "-admin@example.invalid", role: "ADMIN" },
    ] });
    await db.recruiterProfile.create({ data: { userId: scope.actorId, companyId: scope.companyId, companyName: "Synthetic A", status: "APPROVED" } });
    for (const suffix of ["", "-foreign"]) {
      await db.job.create({ data: { id: prefix + suffix, companyId: suffix ? prefix + "-b" : scope.companyId, title: "Synthetic", location: "QA", description: "QA", employmentType: "FULL_TIME", skills: [] } });
      await db.application.create({ data: { id: prefix + suffix, candidateId: scope.candidateId, jobId: prefix + suffix,
        stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 1 } });
    }
    const approvals = createInterviewBlueprintService(createPrismaInterviewBlueprintStore(db));
    const bs = { actorId: scope.actorId, companyId: scope.companyId, jobId: prefix };
    const draft = await approvals.createDraft(bs, blueprint); await approvals.approve(bs, draft.id); approvedId = draft.id;
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.$executeRaw`DELETE FROM "AIInterviewSession" WHERE "companyId" = ${scope.companyId}`;
      await db.$executeRaw`DELETE FROM "AIInterviewBlueprintVersion" WHERE "companyId" = ${scope.companyId}`;
      await db.application.deleteMany({ where: { id: { in: [prefix, prefix + "-foreign"] } } });
      await db.job.deleteMany({ where: { id: { in: [prefix, prefix + "-foreign"] } } });
      await db.recruiterProfile.deleteMany({ where: { userId: scope.actorId } });
      await db.user.deleteMany({ where: { id: { in: [scope.actorId, scope.candidateId, prefix + "-other", prefix + "-admin"] } } });
      await db.company.deleteMany({ where: { id: { in: [scope.companyId, prefix + "-b"] } } });
    } finally { await db.$disconnect(); await second?.$disconnect(); }
  });
  it("issues and audits a session atomically without modifying ATS state", async () => {
    const before = await db.application.findUnique({ where: { id: prefix } });
    const { id } = await issue();
    const [row] = await db.$queryRaw<{ invitedById: string; invitedAt: Date; blueprintVersionId: string }[]>`SELECT "invitedById", "invitedAt", "blueprintVersionId" FROM "AIInterviewSession" WHERE "id" = ${id}`;
    expect(row.invitedById).toBe(scope.actorId); expect(row.invitedAt).toBeInstanceOf(Date); expect(row.blueprintVersionId).toBe(approvedId);
    expect(await db.application.findUnique({ where: { id: prefix } })).toEqual(before);
  });
  it("deduplicates concurrent issuance by request ID across servers and rejects conflicting reuse", async () => {
    const input = await args(); const before = await count();
    const otherRecruiter = createInterviewInvitationService(createPrismaInterviewInvitationStore(second));
    const [a, b] = await Promise.all([recruiter.issue(scope, input), otherRecruiter.issue(scope, input)]);
    expect(a).toEqual(b); expect(await count()).toBe(before + 1);
    await expect(recruiter.issue(scope, { ...input, expiresAt: input.expiresAt + 1 })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
  it.each(["foreign-company", "foreign-application", "missing-application", "admin"])("denies issuance with wrong scope: %s", async kind => {
    const patch = kind === "foreign-company" ? { companyId: prefix + "-b" } : kind === "foreign-application" ? { applicationId: prefix + "-foreign" } : kind === "missing-application" ? { applicationId: "missing" } : { actorId: prefix + "-admin" };
    const before = await count(); await expect(recruiter.issue({ ...scope, ...patch }, await args())).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(await count()).toBe(before);
  });
  it.each(["pending", "inactive", "suspended", "deleted"])("rechecks recruiter permission: %s", async kind => {
    try {
      if (kind === "pending") await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { status: "PENDING" } });
      else await db.user.update({ where: { id: scope.actorId }, data: kind === "inactive" ? { isActive: false } : kind === "suspended" ? { isSuspended: true } : { deletedAt: new Date() } });
      const before = await count(); await expect(issue()).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(await count()).toBe(before);
    } finally {
      await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { status: "APPROVED" } });
      await db.user.update({ where: { id: scope.actorId }, data: { isActive: true, isSuspended: false, deletedAt: null } });
    }
  });
  it.each(["wrong-candidate", "inactive", "suspended", "deleted", "admin-role"])("denies candidate operations, including replays: %s", async kind => {
    const { id } = await issue(); await candidate.execute(id, 0, start);
    try {
      if (kind !== "wrong-candidate") await db.user.update({ where: { id: scope.candidateId }, data: kind === "inactive" ? { isActive: false } : kind === "suspended" ? { isSuspended: true } : kind === "deleted" ? { deletedAt: new Date() } : { role: "ADMIN" } });
      const actor = kind === "wrong-candidate" ? prefix + "-other" : scope.candidateId;
      const acting = createCandidateInterviewService(createPrismaInterviewInvitationStore(db), async () => actor);
      await expect(acting.read(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(acting.execute(id, 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally { await db.user.update({ where: { id: scope.candidateId }, data: { role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null } }); }
  });
  it.each(["legacy", "terminal", "partial", "contradictory", "hold"])("checks canonical/legacy eligibility without ATS writes: %s", async kind => {
    const original = { stage: "REVIEW" as const, disposition: "ACTIVE" as const, status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const, stateVersion: 1 };
    try {
      await db.application.update({ where: { id: prefix }, data: kind === "legacy" ? { stage: null, disposition: null, stateVersion: 0 } : kind === "terminal" ? { stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED" } : kind === "partial" ? { stage: null } : kind === "hold" ? { disposition: "HOLD" } : { status: "HIRED" } });
      if (kind === "legacy") expect((await issue()).id).toEqual(expect.any(String));
      else await expect(issue()).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally { await db.application.update({ where: { id: prefix }, data: original }); }
  });
  it("permits an approved recruiter to cancel even when the candidate is inactive", async () => {
    const { id } = await issue();
    try {
      await db.user.update({ where: { id: scope.candidateId }, data: { isActive: false } });
      await recruiter.cancel(scope, id);
    } finally { await db.user.update({ where: { id: scope.candidateId }, data: { isActive: true } }); }
    await expect(candidate.execute(id, 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("requires an open job for new invitations", async () => {
    try { await db.job.update({ where: { id: prefix }, data: { status: "CLOSED" } }); await expect(issue()).rejects.toMatchObject({ code: "NOT_FOUND" }); }
    finally { await db.job.update({ where: { id: prefix }, data: { status: "OPEN" } }); }
  });
  it("denies expired starts, but invitation expiry does not stop a running interview", async () => {
    const { id } = await issue();
    await db.$executeRaw`UPDATE "AIInterviewSession" SET "invitationExpiresAt" = clock_timestamp() WHERE "id" = ${id}`;
    await expect(candidate.execute(id, 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const running = await issue(); await candidate.execute(running.id, 0, start);
    await db.$executeRaw`UPDATE "AIInterviewSession" SET "invitationExpiresAt" = clock_timestamp() WHERE "id" = ${running.id}`;
    expect((await candidate.execute(running.id, 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).status).toBe("COMPLETED");
  });
  it("serializes two starts and competing answers with persistent idempotency", async () => {
    const { id } = await issue();
    const [a, b] = await Promise.all([candidate.execute(id, 0, start), otherCandidate.execute(id, 0, start)]);
    expect(a).toEqual(b); expect(a.version).toBe(1);
    const answers = await Promise.allSettled([candidate, otherCandidate].map((service, i) => service.execute(id, 1, { type: "SUBMIT_ANSWER", commandId: `answer-${i}`, turnId: "turn-1", answer: `answer-${i}` })));
    expect(answers.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(answers.filter(r => r.status === "rejected")).toMatchObject([{ reason: { code: "VERSION_CONFLICT" } }]);
  });
  it("serializes start against cancellation and never permits access after cancellation", async () => {
    const { id } = await issue();
    const otherRecruiter = createInterviewInvitationService(createPrismaInterviewInvitationStore(second));
    const [starting, cancelling] = await Promise.allSettled([candidate.execute(id, 0, start), otherRecruiter.cancel(scope, id)]);
    expect(cancelling.status).toBe("fulfilled");
    if (starting.status === "fulfilled") expect(starting.value.version).toBe(1);
    else expect(starting.reason).toMatchObject({ code: "NOT_FOUND" });
    await expect(otherCandidate.execute(id, 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const stored = await createInterviewSessionService(createPrismaInterviewStore(db)).read(scope, id);
    expect(stored.version).toBe(starting.status === "fulfilled" ? 1 : 0);
    await recruiter.cancel(scope, id); // no second audit mutation
  });
  it("keeps cancelled/historical sessions private and prevents candidate AI decisions", async () => {
    const internal = createInterviewSessionService(createPrismaInterviewStore(db));
    const old = await internal.create(scope, approvedId);
    await expect(candidate.read(old.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await internal.read(scope, old.id)).snapshot.status).toBe("READY");
    const { id } = await issue();
    await expect(internal.execute(scope, id, 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await candidate.execute(id, 0, start);
    await expect(candidate.execute(id, 1, { type: "APPLY_AI_DECISION", commandId: "bad", decision: { type: "ADVANCE", turnId: "turn-1" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const view = await candidate.read(id);
    for (const secret of ["SECRET_RUBRIC", "blueprint", "commands", "fingerprint", scope.actorId, "approvedById"]) expect(JSON.stringify(view)).not.toContain(secret);
    await recruiter.cancel(scope, id); await expect(candidate.read(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("continues an active interview after transition to ASSESSMENT", async () => {
    const ready = await issue();
    const running = await issue();
    await candidate.execute(running.id, 0, start);

    try {
      await db.application.update({
        where: { id: prefix },
        data: { stage: "ASSESSMENT", stateVersion: { increment: 1 } },
      });

      await expect(issue()).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(candidate.execute(ready.id, 0, start))
        .rejects.toMatchObject({ code: "NOT_FOUND" });

      expect((await candidate.read(running.id)).status).toBe("IN_PROGRESS");

      const result = await candidate.execute(running.id, 1, {
        type: "SKIP_QUESTION",
        commandId: "skip-assessment",
        turnId: "turn-1",
      });

      expect(result.status).toBe("COMPLETED");
    } finally {
      await db.application.update({
        where: { id: prefix },
        data: { stage: "REVIEW", stateVersion: 1 },
      });
    }
  });

  it("blocks commands if a running application becomes terminal without rewriting snapshot", async () => {
    const { id } = await issue(); await candidate.execute(id, 0, start);
    const internal = createInterviewSessionService(createPrismaInterviewStore(db)); const before = await internal.read(scope, id);
    try {
      await db.application.update({ where: { id: prefix }, data: { stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED" } });
      await expect(candidate.execute(id, 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await internal.read(scope, id)).toEqual(before);
    } finally { await db.application.update({ where: { id: prefix }, data: { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW" } }); }
  });
});
