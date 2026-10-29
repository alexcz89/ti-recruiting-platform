import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ find: vi.fn(), actor: vi.fn(), update: vi.fn(), transition: vi.fn() }));
vi.mock("@/lib/server/prisma", () => ({ prisma: { application: { findFirst: db.find, updateMany: db.update }, user: { findFirst: db.actor } } }));
vi.mock("@/lib/hiring-process/transition-application", async (original) => ({
  ...await original<object>(), transitionApplication: db.transition,
}));
import { executeApplicationIntent } from "@/lib/hiring-process/application-intents";
const actor = { type: "RECRUITER" as const, id: "recruiter-a", companyId: "company-a" };
const command = { intent: "START_REVIEW" as const, expectedVersion: 0, commandId: "review-1" };
const source = { id: "app-a", stage: null, disposition: null, stateVersion: 0, status: "SUBMITTED", recruiterInterest: "REVIEW", reviewingAt: null, offerAt: null, hiredAt: null, rejectedAt: null, rejectionEmailSent: false };
const execute = () => executeApplicationIntent({ applicationId: "app-a", actor, command });
beforeEach(() => {
  vi.resetAllMocks();
  db.find.mockResolvedValue(source);
  db.actor.mockResolvedValue({ id: actor.id });
  db.update.mockResolvedValue({ count: 1 });
  db.transition.mockResolvedValue({ state: { stage: "REVIEW", disposition: "ACTIVE", stateVersion: 1 } });
});
describe("START_REVIEW source boundary", () => {
  it("preserves legacy dates and uses the exact source and tenant atomically", async () => {
    const date = new Date("2026-10-01T12:00:00Z");
    db.find.mockResolvedValue({ ...source, reviewingAt: date });
    expect(await execute()).toMatchObject({ replayed: false, state: null, legacy: { status: "REVIEWING", stateVersion: 0 } });
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "app-a", job: { companyId: "company-a" }, stage: null, disposition: null, stateVersion: 0, status: "SUBMITTED", recruiterInterest: "REVIEW" }),
      data: { status: "REVIEWING", recruiterInterest: "REVIEW", reviewingAt: date },
    }));
  });
  it("replays compatible legacy review without writing", async () => {
    db.find.mockResolvedValue({ ...source, status: "REVIEWING" });
    expect(await execute()).toMatchObject({ replayed: true });
    expect(db.update).not.toHaveBeenCalled();
  });
  it.each([
    { status: "REJECTED", recruiterInterest: "REJECTED" },
    { status: "HIRED", recruiterInterest: "ACCEPTED" },
    { status: "INTERVIEW" }, { recruiterInterest: "MAYBE" },
    { rejectedAt: new Date() }, { disposition: "ACTIVE" }, { stateVersion: 1 },
    { stage: "REVIEW", disposition: "HOLD" },
    { stage: "OFFER", disposition: "ACTIVE" },
  ])("rejects incompatible source %j", async (patch) => {
    db.find.mockResolvedValue({ ...source, ...patch });
    await expect(execute()).rejects.toThrow();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.transition).not.toHaveBeenCalled();
  });
  it("rejects a concurrent conversion without falling back to a second write", async () => {
    db.update.mockResolvedValue({ count: 0 });
    await expect(execute()).rejects.toMatchObject({ code: "CONCURRENT_APPLICATION_TRANSITION" });
    expect(db.update).toHaveBeenCalledOnce();
  });
  it("reauthorizes the persisted actor before any replay", async () => {
    db.actor.mockResolvedValue(null);
    await expect(execute()).rejects.toThrow();
    expect(db.find).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not expose applications outside the actor scope", async () => {
    db.find.mockResolvedValue(null);
    await expect(execute()).rejects.toThrow();
    expect(db.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "app-a", job: { companyId: "company-a" } } }));
    expect(db.update).not.toHaveBeenCalled();
  });
  it("delegates canonical state, version and command replay to the existing writer", async () => {
    db.find.mockResolvedValue({ ...source, stage: "APPLIED", disposition: "ACTIVE" });
    await execute();
    expect(db.transition).toHaveBeenCalledWith(expect.objectContaining({ targetStage: "REVIEW", targetDisposition: "ACTIVE", expectedVersion: 0, idempotencyKey: "review-1", actor }), { assertSource: expect.any(Function) });
    expect(db.update).not.toHaveBeenCalled();
  });
});
