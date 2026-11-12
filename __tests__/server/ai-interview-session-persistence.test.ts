import { describe, expect, it, vi } from "vitest";
import { createInterviewSessionService, validateStoredInterview, type InterviewStore, type InterviewTransaction, type StoredInterview } from "@/lib/ai/ai-interview-session-service";
import { createInterviewSession } from "@/lib/ai/ai-interview-conversation-core";

const scope = { actorId: "recruiter", companyId: "company", candidateId: "candidate", applicationId: "application" };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
const start = { type: "START_INTERVIEW", commandId: "start" };
function fixture() {
  let row: StoredInterview | null = null;
  let clock = 1000;
  const tx: InterviewTransaction = {
    authorize: vi.fn(async s => s.actorId === scope.actorId && s.companyId === scope.companyId && s.candidateId === scope.candidateId && s.applicationId === scope.applicationId),
    find: vi.fn(async () => structuredClone(row)), now: vi.fn(async () => clock),
    insert: vi.fn(async (s, snapshot) => { row = { id: "session", companyId: s.companyId, candidateId: s.candidateId, applicationId: s.applicationId, version: 0, snapshot: structuredClone(snapshot) }; return structuredClone(row); }),
    update: vi.fn(async (_s, old, snapshot) => { if (!row || row.version !== old.version) return false; row = { ...row, version: row.version + 1, snapshot: structuredClone(snapshot) }; return true; }),
  };
  const store: InterviewStore = { transaction: async work => work(tx) };
  const service = createInterviewSessionService(store, async () => true);
  return { tx, store, service, setClock: (t: number) => { clock = t; }, getRow: () => row!, setRow: (r: StoredInterview) => { row = r; } };
}
describe("interview persistence service with simulated storage (not PostgreSQL concurrency)", () => {
  it("rejects a different authorized application of the same candidate on read and replay", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); await f.service.execute(scope, "session", 0, start);
    vi.mocked(f.tx.authorize).mockResolvedValue(true);
    const other = { ...scope, applicationId: "another-application" };
    await expect(f.service.read(other, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.execute(other, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.update).toHaveBeenCalledTimes(1);
  });
  it("checks scope and revoked permissions for create, read and commands", async () => {
    const f = fixture(); await f.service.create(scope, blueprint);
    vi.mocked(f.tx.authorize).mockResolvedValue(false);
    await expect(f.service.create(scope, blueprint)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.execute(scope, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.insert).toHaveBeenCalledTimes(1); expect(f.tx.update).not.toHaveBeenCalled();
  });
  it.each(["", " ", undefined])("rejects malformed application scope %j without touching storage", async applicationId => {
    const f = fixture(); const invalid = { ...scope, applicationId } as typeof scope;
    await expect(f.service.create(invalid, blueprint)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it("denies creation until approval is explicitly supplied by a trusted integration", async () => {
    const f = fixture(); await expect(createInterviewSessionService(f.store).create(scope, blueprint)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it("creates, reads and isolates the complete snapshot", async () => {
    const f = fixture(); const created = await f.service.create(scope, blueprint);
    created.snapshot.blueprint.questions[0].text = "mutated";
    expect((await f.service.read(scope, created.id)).snapshot).toEqual(createInterviewSession(blueprint));
  });
  it("increments once and replays across new service instances with stale versions", async () => {
    const f = fixture(); await f.service.create(scope, blueprint);
    const first = await f.service.execute(scope, "session", 0, start);
    expect(first.version).toBe(1);
    const restarted = createInterviewSessionService(f.store);
    expect(await restarted.execute(scope, "session", 0, start)).toEqual(first);
    expect(f.tx.update).toHaveBeenCalledTimes(1);
    expect(f.tx.find).toHaveBeenLastCalledWith(scope, "session", true);
  });
  it("rejects conflicting IDs, stale versions and failed compare-and-set", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); await f.service.execute(scope, "session", 0, start);
    await expect(f.service.execute(scope, "session", 0, { type: "EXPIRE_INTERVIEW", commandId: "start" })).rejects.toMatchObject({ code: "COMMAND_CONFLICT" });
    const answer = { type: "SUBMIT_ANSWER", commandId: "answer", turnId: "turn-1", answer: "Answer" };
    await expect(f.service.execute(scope, "session", 0, answer)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    vi.mocked(f.tx.update).mockResolvedValueOnce(false);
    await expect(f.service.execute(scope, "session", 1, answer)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(f.getRow().version).toBe(1);
  });
  it("uses store time, rejects late input and retains history on explicit expiry", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); const active = await f.service.execute(scope, "session", 0, start);
    f.setClock(active.snapshot.expiresAt!);
    await expect(f.service.execute(scope, "session", 1, { type: "SUBMIT_ANSWER", commandId: "answer", turnId: "turn-1", answer: "late" })).rejects.toMatchObject({ code: "INTERVIEW_EXPIRED" });
    const expired = await f.service.execute(scope, "session", 1, { type: "EXPIRE_INTERVIEW", commandId: "expire" });
    expect(expired.snapshot.history).toEqual(active.snapshot.history);
    expect(await f.service.execute(scope, "session", 0, start)).toEqual(expired);
  });
  it.each([{ companyId: "other" }, { candidateId: "other" }, { actorId: "other" }, { applicationId: "missing" }])("rejects unauthorized scope %j before reading", async patch => {
    const f = fixture(); await expect(f.service.read({ ...scope, ...patch }, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.find).not.toHaveBeenCalled();
  });
  it("rejects mismatched metadata even if a store returns an unrelated row", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); f.setRow({ ...f.getRow(), candidateId: "other" });
    await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each([null, {}, { status: "READY", blueprint, commands: [], extra: true }])("rejects arbitrary JSON %j", value => {
    expect(() => validateStoredInterview(value)).toThrow("INVALID_SNAPSHOT");
  });
  it("revalidates active snapshots, receipts and versions before returning them", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); const active = await f.service.execute(scope, "session", 0, start);
    for (const snapshot of [{ ...active.snapshot, phase: "AWAITING_AI_DECISION" }, { ...active.snapshot, commands: [{ ...active.snapshot.commands[0], fingerprint: "0".repeat(64) }] }]) {
      f.setRow({ ...active, snapshot }); await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
    }
    f.setRow({ ...active, version: 10 }); await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
  });
  it("accepts reordered JSONB keys and completed snapshots", async () => {
    const f = fixture(); await f.service.create(scope, blueprint); await f.service.execute(scope, "session", 0, start);
    const ended = await f.service.execute(scope, "session", 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" });
    expect(validateStoredInterview(Object.fromEntries(Object.entries(ended.snapshot).reverse()))).toEqual(ended.snapshot);
  });
});
