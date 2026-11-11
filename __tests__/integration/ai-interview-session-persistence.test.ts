import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createInterviewSessionService } from "@/lib/ai/ai-interview-session-service";
import { createPrismaInterviewStore } from "@/lib/ai/prisma-ai-interview-session-store";
import { applyInterviewCommand, createInterviewSession } from "@/lib/ai/ai-interview-conversation-core";

// Dedicated opt-in database only. Never load .env or use the application singleton.
const enabled = process.env.RUN_AI_INTERVIEW_DB_TESTS === "true";
const url = process.env.AI_INTERVIEW_TEST_DATABASE_URL ?? "";
if (enabled) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/taskio_ai_interview_test" || parsed.searchParams.has("host")) throw new Error("Disposable loopback interview database required");
}
const prefix = `qa-ai-${randomUUID()}`;
const scope = { actorId: prefix + "-r", companyId: prefix + "-a", candidateId: prefix + "-c" };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
const start = { type: "START_INTERVIEW" as const, commandId: "start" };
let db: PrismaClient;
let second: PrismaClient;
let service: ReturnType<typeof createInterviewSessionService>;
let otherServer: ReturnType<typeof createInterviewSessionService>;
describe.skipIf(!enabled)("interview persistence with real PostgreSQL (schema must already be provisioned locally)", () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } }); second = new PrismaClient({ datasources: { db: { url } } });
    service = createInterviewSessionService(createPrismaInterviewStore(db), async () => true);
    otherServer = createInterviewSessionService(createPrismaInterviewStore(second), async () => true);
    await db.company.createMany({ data: [{ id: scope.companyId, name: "Synthetic A" }, { id: prefix + "-b", name: "Synthetic B" }] });
    await db.user.createMany({ data: [{ id: scope.actorId, email: prefix + "-r@example.invalid", role: "RECRUITER" }, { id: scope.candidateId, email: prefix + "-c@example.invalid", role: "CANDIDATE" }] });
    await db.recruiterProfile.create({ data: { userId: scope.actorId, companyId: scope.companyId, companyName: "Synthetic A", status: "APPROVED" } });
    await db.job.create({ data: { id: prefix, companyId: scope.companyId, title: "Synthetic", description: "QA", location: "QA", employmentType: "FULL_TIME", skills: [] } });
    await db.application.create({ data: { id: prefix, jobId: prefix, candidateId: scope.candidateId } });
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.$executeRaw`DELETE FROM "AIInterviewSession" WHERE "companyId" = ${scope.companyId}`;
      await db.application.deleteMany({ where: { id: prefix } }); await db.job.deleteMany({ where: { id: prefix } });
      await db.recruiterProfile.deleteMany({ where: { userId: scope.actorId } });
      await db.user.deleteMany({ where: { id: { in: [scope.actorId, scope.candidateId] } } });
      await db.company.deleteMany({ where: { id: { in: [scope.companyId, prefix + "-b"] } } });
    } finally { await db.$disconnect(); await second?.$disconnect(); }
  });
  it("round-trips JSONB snapshots and persists identical concurrent commands once across clients", async () => {
    const row = await service.create(scope, blueprint);
    expect((await otherServer.read(scope, row.id)).snapshot).toEqual(row.snapshot);
    const [a, b] = await Promise.all([service.execute(scope, row.id, 0, start), otherServer.execute(scope, row.id, 0, start)]);
    expect(a).toEqual(b); expect(a.version).toBe(1); expect(a.snapshot.commands).toHaveLength(1);
  });
  it("permits only one distinct concurrent answer for the same version", async () => {
    const row = await service.create(scope, blueprint); await service.execute(scope, row.id, 0, start);
    const results = await Promise.allSettled([service, otherServer].map((s, i) => s.execute(scope, row.id, 1, { type: "SUBMIT_ANSWER", commandId: `answer-${i}`, turnId: "turn-1", answer: `Answer ${i}` })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: "VERSION_CONFLICT" }) })]);
    const final = await service.read(scope, row.id); expect(final.version).toBe(2); expect(final.snapshot.commands).toHaveLength(2);
  });
  it("rejects conflicting replay content and leaves the database unchanged", async () => {
    const row = await service.create(scope, blueprint); const active = await service.execute(scope, row.id, 0, start);
    await expect(otherServer.execute(scope, row.id, 0, { type: "EXPIRE_INTERVIEW", commandId: "start" })).rejects.toMatchObject({ code: "COMMAND_CONFLICT" });
    expect(await service.read(scope, row.id)).toEqual(active);
  });
  it("rejects company/candidate scope substitution and unapproved actors", async () => {
    const row = await service.create(scope, blueprint);
    for (const patch of [{ companyId: prefix + "-b" }, { candidateId: scope.actorId }, { actorId: scope.candidateId }]) await expect(service.read({ ...scope, ...patch }, row.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { status: "PENDING" } });
    try { await expect(service.read(scope, row.id)).rejects.toMatchObject({ code: "NOT_FOUND" }); }
    finally { await db.recruiterProfile.update({ where: { userId: scope.actorId }, data: { status: "APPROVED" } }); }
  });
  it("uses PostgreSQL time and preserves valid expired history", async () => {
    const row = await service.create(scope, blueprint);
    const historical = applyInterviewCommand(createInterviewSession(blueprint), start, 0);
    await db.$executeRaw`UPDATE "AIInterviewSession" SET "snapshot" = ${JSON.stringify(historical)}::jsonb, "version" = 1 WHERE "id" = ${row.id}`;
    await expect(service.execute(scope, row.id, 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).rejects.toMatchObject({ code: "INTERVIEW_EXPIRED" });
    const expired = await service.execute(scope, row.id, 1, { type: "EXPIRE_INTERVIEW", commandId: "expire" });
    expect(expired.snapshot.history).toEqual(historical.history); expect(expired.version).toBe(2);
    expect(await otherServer.execute(scope, row.id, 0, start)).toEqual(expired);
  });
  it("rejects corrupted stored JSON without exposing it", async () => {
    const row = await service.create(scope, blueprint);
    await db.$executeRaw`UPDATE "AIInterviewSession" SET "snapshot" = '{}'::jsonb WHERE "id" = ${row.id}`;
    await expect(service.read(scope, row.id)).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
  });
});
