import { describe, expect, it, vi } from "vitest";
import type { PrismaClient, Prisma } from "@prisma/client";
import { createPrismaInterviewBlueprintStore } from "@/lib/ai/prisma-ai-interview-blueprint-store";
import { InterviewBlueprintSchema } from "@/lib/ai/ai-interview-blueprint-contract";

const scope = { actorId: "actor", companyId: "company", jobId: "job" };
function fixture() {
  const tx = { user: { findFirst: vi.fn(async () => ({ id: "actor" })) }, job: { findFirst: vi.fn(async () => ({ id: "job" })) }, $queryRaw: vi.fn(async (_query: Prisma.Sql) => []) };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => work(tx));
  return { tx, transaction, store: createPrismaInterviewBlueprintStore({ $transaction: transaction } as unknown as PrismaClient) };
}
describe("blueprint Prisma adapter (mocked SQL contracts)", () => {
  it("inserts a fresh scoped version with server actor and parameterized JSONB", async () => {
    const f = fixture();
    const blueprint = InterviewBlueprintSchema.parse({ plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Question", order: 0 }] });
    await f.store.transaction(tx => tx.insert(scope, blueprint));
    const query = f.tx.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual([expect.any(String), "company", "job", JSON.stringify(blueprint), "actor"]);
    expect(query.sql).toContain('::jsonb'); expect(query.sql).not.toContain("Question");
  });
  it("requires persisted active approved recruiter and exact job ownership, no ADMIN bypass", async () => {
    const f = fixture(); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(true);
    expect(f.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "actor", role: "RECRUITER", isActive: true, isSuspended: false, deletedAt: null, recruiterProfile: { is: { companyId: "company", status: "APPROVED" } } }, select: { id: true } });
    expect(f.tx.job.findFirst).toHaveBeenCalledWith({ where: { id: "job", companyId: "company" }, select: { id: true } });
    f.tx.user.findFirst.mockResolvedValueOnce(null!); f.tx.job.findFirst.mockClear();
    expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false); expect(f.tx.job.findFirst).not.toHaveBeenCalled();
    f.tx.job.findFirst.mockResolvedValueOnce(null!); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false);
  });
  it.each([false, true])("scopes the lookup and locks writes (%s)", async lock => {
    const f = fixture(); await f.store.transaction(tx => tx.find(scope, "id' OR 1=1", lock));
    const query = f.tx.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual(["id' OR 1=1", "company", "job"]);
    expect(query.sql).not.toContain("OR 1=1"); expect(query.sql.includes("FOR UPDATE")).toBe(lock);
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted", timeout: 10000 });
  });
  it("only changes approval metadata using database time and guarded scope/status", async () => {
    const f = fixture(); await f.store.transaction(tx => tx.approve(scope, "version", "hash"));
    const query = f.tx.$queryRaw.mock.calls[0][0];
    expect(query.values).toEqual(["actor", "hash", "version", "company", "job"]);
    expect(query.sql).toContain("clock_timestamp()"); expect(query.sql).toContain('AND "status" = \'DRAFT\'');
    expect(query.sql.split("WHERE")[0]).not.toContain('"blueprint" =');
    await f.store.transaction(tx => tx.revoke(scope, "version"));
    const revoke = f.tx.$queryRaw.mock.calls[1][0];
    expect(revoke.values).toEqual(["version", "company", "job"]);
    expect(revoke.sql).toContain('AND "status" = \'APPROVED\'');
    expect(revoke.sql.split("WHERE")[0]).not.toContain('"approvedById" =');
  });
});
