import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createPrismaInterviewStore } from "@/lib/ai/prisma-ai-interview-session-store";
import { createInterviewSession } from "@/lib/ai/ai-interview-conversation-core";

function fixture() {
  const tx = { user: { findFirst: vi.fn(async () => ({ id: "actor" })) }, application: { findFirst: vi.fn(async () => ({ id: "application" })) }, $queryRaw: vi.fn(async (..._args: unknown[]) => []), $executeRaw: vi.fn(async (..._args: unknown[]) => 1) };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => work(tx));
  return { tx, transaction, store: createPrismaInterviewStore({ $transaction: transaction } as unknown as PrismaClient) };
}
const scope = { actorId: "actor", companyId: "company", candidateId: "candidate", applicationId: "application" };
describe("Prisma interview adapter query contracts (SQL mocked, not concurrency evidence)", () => {
  it("persists application ownership and includes it in versioned UPDATE predicates", async () => {
    const f = fixture();
    const snapshot = createInterviewSession({ plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Question", order: 0 }] });
    await f.store.transaction(tx => tx.insert(scope, snapshot, "approved"));
    const [insertSql, uuid, ...insertValues] = f.tx.$queryRaw.mock.calls[0];
    expect((insertSql as string[]).join("?")).toContain('"applicationId"');
    expect(uuid).toEqual(expect.any(String));
    expect(insertValues).toEqual(["company", "candidate", "application", JSON.stringify(snapshot), "approved"]);
    await f.store.transaction(tx => tx.update(scope, { blueprintVersionId: "approved", id: "session", companyId: "company", candidateId: "candidate", applicationId: "application", version: 2, snapshot }, snapshot));
    const [updateSql, ...updateValues] = f.tx.$executeRaw.mock.calls[0];
    expect((updateSql as string[]).join("?")).toContain('AND "applicationId" = ? AND "version" = ?');
    expect(updateValues).toEqual([JSON.stringify(snapshot), "session", "company", "candidate", "application", 2]);
  });
  it("locks the exact application/job and approved version on the existing transaction", async () => {
    const f = fixture();
    f.tx.$queryRaw.mockResolvedValueOnce([{ jobId: "job" }] as never).mockResolvedValueOnce([{ id: "approved" }] as never);
    expect(await f.store.transaction(tx => tx.findBlueprint(scope, "approved"))).toEqual({ jobId: "job", version: { id: "approved" } });
    const [sql, ...values] = f.tx.$queryRaw.mock.calls[0];
    expect((sql as string[]).join("?")).toContain("FOR SHARE OF a, j");
    expect(values).toEqual([scope.applicationId, scope.candidateId, scope.companyId]);
    const query = f.tx.$queryRaw.mock.calls[1][0] as unknown as { sql: string; values: unknown[] };
    expect(query.sql).toContain("FOR UPDATE"); expect(query.values).toEqual(["approved", "company", "job"]);
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it("requires an active approved recruiter of the exact company without an ADMIN bypass", async () => {
    const f = fixture(); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(true);
    expect(f.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "actor", isActive: true, isSuspended: false, deletedAt: null,
      role: "RECRUITER",
      recruiterProfile: { is: { companyId: "company", status: "APPROVED" } },
    }, select: { id: true } });
    expect(f.tx.application.findFirst).toHaveBeenCalledWith({ where: { id: "application", candidateId: "candidate", job: { companyId: "company" }, candidate: { role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null } }, select: { id: true } });
  });
  it("fails closed for a missing actor or a missing candidate-company relationship", async () => {
    const f = fixture(); f.tx.user.findFirst.mockResolvedValueOnce(null!);
    expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false); expect(f.tx.application.findFirst).not.toHaveBeenCalled();
    f.tx.application.findFirst.mockResolvedValueOnce(null!); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false);
  });
  it.each([false, true])("scopes parameterized SELECT and requests row locking only for writes (%s)", async lock => {
    const f = fixture(); await f.store.transaction(tx => tx.find(scope, "session", lock));
    const query = f.tx.$queryRaw.mock.calls[0][0] as unknown as { sql: string; values: unknown[] };
    expect(query.values).toEqual(["session", "company", "candidate", "application"]);
    expect(query.sql.includes("FOR UPDATE")).toBe(lock);
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted", timeout: 10000 });
  });
});
