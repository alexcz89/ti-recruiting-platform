import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createInterviewBlueprintService, fingerprintInterviewBlueprint } from "@/lib/ai/ai-interview-blueprint-service";
import { createPrismaInterviewBlueprintStore } from "@/lib/ai/prisma-ai-interview-blueprint-store";

// Explicit opt-in, dedicated local database only. No .env loading or singleton.
// Apply the additive migration locally before enabling this suite.
const enabled = process.env.RUN_AI_INTERVIEW_DB_TESTS === "true";
const url = process.env.AI_INTERVIEW_TEST_DATABASE_URL ?? "";
if (enabled) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/taskio_ai_interview_test" || parsed.searchParams.has("host")) throw new Error("Disposable loopback interview database required");
}
const prefix = `qa-blueprint-${randomUUID()}`;
const scope = { actorId: prefix + "-r", companyId: prefix + "-a", jobId: prefix + "-j" };
const otherActor = { ...scope, actorId: prefix + "-r2" };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
let db: PrismaClient;
let second: PrismaClient;
let service: ReturnType<typeof createInterviewBlueprintService>;
let otherServer: ReturnType<typeof createInterviewBlueprintService>;
const companies = [scope.companyId, prefix + "-b"];
const users = [scope.actorId, otherActor.actorId, prefix + "-admin", prefix + "-candidate"];
const jobs = [scope.jobId, prefix + "-other-job", prefix + "-foreign-job"];

describe.skipIf(!enabled)("blueprint approval with real PostgreSQL (provisioned disposable database)", () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } }); second = new PrismaClient({ datasources: { db: { url } } });
    service = createInterviewBlueprintService(createPrismaInterviewBlueprintStore(db));
    otherServer = createInterviewBlueprintService(createPrismaInterviewBlueprintStore(second));
    await db.company.createMany({ data: companies.map(id => ({ id, name: "Synthetic blueprint QA" })) });
    await db.user.createMany({ data: users.map((id, index) => ({ id, email: `${id}@example.invalid`, role: index < 2 ? "RECRUITER" : index === 2 ? "ADMIN" : "CANDIDATE" })) });
    for (const userId of users.slice(0, 2)) await db.recruiterProfile.create({ data: { userId, companyId: scope.companyId, companyName: "Synthetic blueprint QA", status: "APPROVED" } });
    for (const [index, id] of jobs.entries()) await db.job.create({ data: { id, companyId: index === 2 ? companies[1] : scope.companyId, title: "Synthetic", description: "QA", location: "QA", employmentType: "FULL_TIME", skills: [] } });
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.$executeRaw`DELETE FROM "AIInterviewBlueprintVersion" WHERE "companyId" = ${scope.companyId}`;
      await db.job.deleteMany({ where: { id: { in: jobs } } });
      await db.recruiterProfile.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.company.deleteMany({ where: { id: { in: companies } } });
    } finally { await db.$disconnect(); await second?.$disconnect(); }
  });

  it("creates validated JSONB drafts, then persists approval actor, database time and fingerprint", async () => {
    await expect(service.createDraft(scope, { ...blueprint, questions: [] })).rejects.toMatchObject({ code: "INVALID_BLUEPRINT" });
    const draft = await service.createDraft(scope, blueprint);
    expect(draft).toMatchObject({ status: "DRAFT", createdById: scope.actorId, approvedById: null, approvedAt: null, fingerprint: null });
    await expect(service.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
    const [before] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    const approved = await service.approve(otherActor, draft.id);
    const [after] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    expect(approved).toMatchObject({ blueprint, createdById: scope.actorId, approvedById: otherActor.actorId, fingerprint: fingerprintInterviewBlueprint(blueprint), status: "APPROVED" });
    expect(approved.approvedAt!.getTime()).toBeGreaterThanOrEqual(before.now.getTime());
    expect(approved.approvedAt!.getTime()).toBeLessThanOrEqual(after.now.getTime() + 1); // TIMESTAMP(3) rounding
    expect(await otherServer.readApproved(scope, draft.id)).toEqual(approved);
    expect(await service.approve(scope, draft.id)).toEqual(approved);
  });

  it("rejects a direct approval without audit metadata and preserves the draft", async () => {
    const draft = await service.createDraft(scope, blueprint);
    const error: unknown = await db.$executeRaw`
      UPDATE "AIInterviewBlueprintVersion" SET "status" = 'APPROVED'
      WHERE "id" = ${draft.id} AND "companyId" = ${scope.companyId} AND "jobId" = ${scope.jobId}`
      .then(() => null, failure => failure);
    expect(error).toBeInstanceOf(Error);
    const failure = error as Error & { code?: string; meta?: { code?: string; message?: string } };
    expect(failure.code === "P2010" && failure.meta?.code === "23514" &&
      failure.meta?.message?.includes("AIInterviewBlueprintVersion_approval_check")).toBe(true);
    const [stored] = await db.$queryRaw<Array<{
      status: string; approvedById: string | null; approvedAt: Date | null; fingerprint: string | null; blueprint: unknown;
    }>>`SELECT "status", "approvedById", "approvedAt", "fingerprint", "blueprint"
      FROM "AIInterviewBlueprintVersion" WHERE "id" = ${draft.id}`;
    expect(stored).toEqual({ status: "DRAFT", approvedById: null, approvedAt: null,
      fingerprint: null, blueprint: draft.blueprint });
    await expect(service.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
  });

  it("retains immutable versions and snapshots when caller changes input or creates a replacement", async () => {
    const input = structuredClone(blueprint);
    const draft = await service.createDraft(scope, input); const approved = await service.approve(scope, draft.id);
    input.questions[0].text = "Different question"; draft.blueprint.questions[0].text = "Mutated returned record";
    const replacement = await service.createDraft(scope, input);
    expect(replacement.id).not.toBe(draft.id);
    expect(await otherServer.readApproved(scope, draft.id)).toEqual(approved);
    await expect(service.readApproved(scope, replacement.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
  });

  it("isolates company, job and version IDs and denies global administrators and candidates", async () => {
    const draft = await service.createDraft(scope, blueprint); const approved = await service.approve(scope, draft.id);
    for (const wrong of [{ ...scope, actorId: users[2] }, { ...scope, actorId: users[3] }, { ...scope, jobId: jobs[2] }, { ...scope, companyId: companies[1] }, { ...scope, jobId: "missing" }]) {
      await expect(service.createDraft(wrong, blueprint)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.approve(wrong, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.readApproved(wrong, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.revoke(wrong, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    const otherJob = { ...scope, jobId: jobs[1] };
    await service.createDraft(otherJob, blueprint); // authorized job, wrong version
    await expect(service.readApproved(otherJob, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.approve(otherJob, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.revoke(otherJob, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await service.readApproved(scope, draft.id)).toEqual(approved);
  });

  it.each(["pending", "other-company", "suspended", "inactive", "deleted", "admin-with-profile"])("rechecks persisted permissions for all operations and approval replays: %s", async kind => {
    const draft = await service.createDraft(scope, blueprint); const approved = await service.approve(scope, draft.id);
    try {
      if (kind === "pending") await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { status: "PENDING" } });
      if (kind === "other-company") await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { companyId: companies[1] } });
      if (kind === "suspended") await db.user.update({ where: { id: scope.actorId }, data: { isSuspended: true } });
      if (kind === "inactive") await db.user.update({ where: { id: scope.actorId }, data: { isActive: false } });
      if (kind === "deleted") await db.user.update({ where: { id: scope.actorId }, data: { deletedAt: new Date() } });
      if (kind === "admin-with-profile") await db.user.update({ where: { id: scope.actorId }, data: { role: "ADMIN" } });
      await expect(service.createDraft(scope, blueprint)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.approve(scope, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.revoke(scope, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      await db.user.update({ where: { id: scope.actorId }, data: { role: "RECRUITER", isActive: true, isSuspended: false, deletedAt: null } });
      await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { companyId: scope.companyId, status: "APPROVED" } });
    }
    expect(await service.readApproved(scope, draft.id)).toEqual(approved);
  });

  it("serializes concurrent approval across independent clients and preserves the first approver", async () => {
    const draft = await service.createDraft(scope, blueprint);
    const [a, b] = await Promise.all([service.approve(scope, draft.id), otherServer.approve(otherActor, draft.id)]);
    expect(a).toEqual(b); expect([scope.actorId, otherActor.actorId]).toContain(a.approvedById);
    const [count] = await db.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM "AIInterviewBlueprintVersion" WHERE "id" = ${draft.id}`;
    expect(count.count).toBe(1);
    expect(await otherServer.approve(otherActor, draft.id)).toEqual(a);
  });

  it("serializes approval replay against revocation and never resurrects an approved version", async () => {
    const draft = await service.createDraft(scope, blueprint); const approved = await service.approve(scope, draft.id);
    const [approval, revocation] = await Promise.allSettled([service.approve(scope, draft.id), otherServer.revoke(otherActor, draft.id)]);
    expect(revocation).toMatchObject({ status: "fulfilled", value: { ...approved, status: "REVOKED" } });
    if (approval.status === "fulfilled") expect(approval.value).toEqual(approved);
    else expect(approval.reason).toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(service.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
    expect(await service.revoke(scope, draft.id)).toEqual({ ...approved, status: "REVOKED" });
    await expect(otherServer.approve(scope, draft.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects draft revocation and makes concurrent repeated revocations idempotent", async () => {
    const draft = await service.createDraft(scope, blueprint);
    await expect(service.revoke(scope, draft.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const approved = await service.approve(scope, draft.id);
    const [a, b] = await Promise.all([service.revoke(scope, draft.id), otherServer.revoke(otherActor, draft.id)]);
    expect(a).toEqual(b); expect(a).toEqual({ ...approved, status: "REVOKED" });
  });

  it.each(["valid-content", "invalid-json", "fingerprint"])("detects privileged out-of-band tampering rather than silently approving it: %s", async kind => {
    const draft = await service.createDraft(scope, blueprint); await service.approve(scope, draft.id);
    // Only synthetic rows in the guarded database. Simulates corruption outside
    // the service; SHA-256 is integrity detection, not a signature against a DBA.
    if (kind === "fingerprint") await db.$executeRaw`UPDATE "AIInterviewBlueprintVersion" SET "fingerprint" = ${"0".repeat(64)} WHERE "id" = ${draft.id}`;
    else {
      const altered = kind === "invalid-json" ? {} : { ...blueprint, questions: [{ ...blueprint.questions[0], text: "Altered" }] };
      await db.$executeRaw`UPDATE "AIInterviewBlueprintVersion" SET "blueprint" = ${JSON.stringify(altered)}::jsonb WHERE "id" = ${draft.id}`;
    }
    await expect(otherServer.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "INTEGRITY_ERROR" });
    await expect(service.approve(scope, draft.id)).rejects.toMatchObject({ code: "INTEGRITY_ERROR" });
  });

  it("restricts job deletion and keeps the approved version intact", async () => {
    const draft = await service.createDraft(scope, blueprint); const approved = await service.approve(scope, draft.id);
    const error: unknown = await db.job.delete({ where: { id: scope.jobId } }).then(() => null, failure => failure);
    expect(error).toBeInstanceOf(Error);
    const failure = error as Error & { code?: string };
    expect(failure.code === "P2003" || (failure.name === "PrismaClientUnknownRequestError" && /\b23001\b/.test(failure.message) && failure.message.includes("AIInterviewBlueprintVersion_jobId_fkey"))).toBe(true);
    expect(await db.job.findUnique({ where: { id: scope.jobId }, select: { id: true } })).toEqual({ id: scope.jobId });
    expect(await service.readApproved(scope, draft.id)).toEqual(approved);
  });
});
