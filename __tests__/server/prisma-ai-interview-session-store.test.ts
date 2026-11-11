import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createPrismaInterviewStore } from "@/lib/ai/prisma-ai-interview-session-store";

function fixture() {
  const tx = { user: { findFirst: vi.fn(async () => ({ id: "actor" })) }, application: { findFirst: vi.fn(async () => ({ id: "application" })) }, $queryRaw: vi.fn(async (_query: unknown) => []), $executeRaw: vi.fn(async () => 1) };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => work(tx));
  return { tx, transaction, store: createPrismaInterviewStore({ $transaction: transaction } as unknown as PrismaClient) };
}
const scope = { actorId: "actor", companyId: "company", candidateId: "candidate" };
describe("Prisma interview adapter query contracts (SQL mocked, not concurrency evidence)", () => {
  it("checks persisted actor status, explicit admin/recruiter roles and approved company membership", async () => {
    const f = fixture(); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(true);
    expect(f.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "actor", isActive: true, isSuspended: false, deletedAt: null,
      OR: [{ role: "ADMIN" }, { role: "RECRUITER", recruiterProfile: { is: { companyId: "company", status: "APPROVED" } } }],
    }, select: { id: true } });
    expect(f.tx.application.findFirst).toHaveBeenCalledWith({ where: { candidateId: "candidate", job: { companyId: "company" }, candidate: { role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null } }, select: { id: true } });
  });
  it("fails closed for a missing actor or a missing candidate-company relationship", async () => {
    const f = fixture(); f.tx.user.findFirst.mockResolvedValueOnce(null!);
    expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false); expect(f.tx.application.findFirst).not.toHaveBeenCalled();
    f.tx.application.findFirst.mockResolvedValueOnce(null!); expect(await f.store.transaction(tx => tx.authorize(scope))).toBe(false);
  });
  it.each([false, true])("scopes parameterized SELECT and requests row locking only for writes (%s)", async lock => {
    const f = fixture(); await f.store.transaction(tx => tx.find(scope, "session", lock));
    const query = f.tx.$queryRaw.mock.calls[0][0] as unknown as { sql: string; values: unknown[] };
    expect(query.values).toEqual(["session", "company", "candidate"]);
    expect(query.sql.includes("FOR UPDATE")).toBe(lock);
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted", timeout: 10000 });
  });
});
