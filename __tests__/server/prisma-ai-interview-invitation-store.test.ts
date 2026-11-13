import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createPrismaInterviewInvitationStore } from "@/lib/ai/prisma-ai-interview-invitation-store";

function fixture() {
  const tx = { application: { findFirst: vi.fn(async () => ({ id: "app" })) }, user: { findFirst: vi.fn(async () => ({ id: "candidate" })) },
    $queryRaw: vi.fn(async (..._args: unknown[]) => [{ id: "session", candidateId: "candidate" }]),
    $executeRaw: vi.fn(async (..._args: unknown[]) => 1),
  };
  const transaction = vi.fn(async (work: (value: typeof tx) => unknown) => work(tx));
  return { tx, transaction, store: createPrismaInterviewInvitationStore({ $transaction: transaction } as unknown as PrismaClient) };
}
describe("Prisma invitation query contracts (mocked, not concurrency evidence)", () => {
  it("requires a persisted active candidate and rechecks after the session lock", async () => {
    const f = fixture(); await f.store.transaction(tx => tx.candidate("candidate", "session"));
    expect(f.tx.user.findFirst).toHaveBeenCalledTimes(2);
    expect(f.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "candidate", role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null }, select: { id: true } });
    const [sql, ...values] = f.tx.$queryRaw.mock.calls[0];
    expect((sql as string[]).join("?")).toContain('AND "candidateId" = ? FOR UPDATE');
    expect(values).toEqual(["session", "candidate"]);
    f.tx.user.findFirst.mockResolvedValueOnce({ id: "candidate" }).mockResolvedValueOnce(null!);
    expect(await f.store.transaction(tx => tx.candidate("candidate", "session"))).toBeNull();
  });
  it("does not retrieve a session for unauthorized actors", async () => {
    const f = fixture(); f.tx.user.findFirst.mockResolvedValueOnce(null!);
    expect(await f.store.transaction(tx => tx.candidate("admin", "session"))).toBeNull(); expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("allows scoped cancellation without granting inactive candidates access", async () => {
    const f = fixture(); const scope = { actorId: "recruiter", companyId: "company", applicationId: "app", candidateId: "candidate" };
    expect(await f.store.transaction(tx => tx.authorizeCancellation(scope))).toBe(true);
    expect(f.tx.user.findFirst).toHaveBeenCalledWith({ where: { id: "recruiter", role: "RECRUITER", isActive: true, isSuspended: false, deletedAt: null, recruiterProfile: { is: { companyId: "company", status: "APPROVED" } } }, select: { id: true } });
    expect(f.tx.application.findFirst).toHaveBeenCalledWith({ where: { id: "app", candidateId: "candidate", job: { companyId: "company" } }, select: { id: true } });
    f.tx.user.findFirst.mockResolvedValueOnce(null!); f.tx.application.findFirst.mockClear();
    expect(await f.store.transaction(tx => tx.authorizeCancellation(scope))).toBe(false); expect(f.tx.application.findFirst).not.toHaveBeenCalled();
  });
  it("uses a transaction-scoped advisory lock whose selected type is not void", async () => {
    const f = fixture(); await f.store.transaction(tx => tx.lockRequest("company", "request"));
    const [sql, ...values] = f.tx.$queryRaw.mock.calls[0];
    expect((sql as string[]).join("?")).toContain("SELECT 1 AS locked FROM pg_advisory_xact_lock");
    expect(values).toEqual([JSON.stringify(["company", "request"])]);
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted", timeout: 10_000 });
  });
  it("scopes cancellation by candidate, application and company, preserving first cancellation", async () => {
    const f = fixture(); await f.store.transaction(tx => tx.cancel({ actorId: "recruiter", companyId: "company", applicationId: "app", candidateId: "candidate" }, "session"));
    const [sql, ...values] = f.tx.$executeRaw.mock.calls[0];
    expect(values).toEqual(["recruiter", "session", "company", "candidate", "app"]);
    expect((sql as string[]).join("?")).toContain('"invitationCancelledAt" IS NULL');
  });
});
