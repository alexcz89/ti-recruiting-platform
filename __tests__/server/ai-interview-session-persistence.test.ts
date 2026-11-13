import { fingerprintInterviewBlueprint } from "@/lib/ai/ai-interview-blueprint-service";
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
    findBlueprint: vi.fn(async () => ({ jobId: "job", version: { id: "approved", companyId: scope.companyId, jobId: "job", blueprint: structuredClone(blueprint), status: "APPROVED" as const, createdById: scope.actorId, approvedById: scope.actorId, approvedAt: new Date(1000), createdAt: new Date(0), fingerprint: fingerprintInterviewBlueprint(blueprint) } })),
    authorize: vi.fn(async s => s.actorId === scope.actorId && s.companyId === scope.companyId && s.candidateId === scope.candidateId && s.applicationId === scope.applicationId),
    find: vi.fn(async () => structuredClone(row)), now: vi.fn(async () => clock),
    insert: vi.fn(async (s, snapshot, blueprintVersionId) => { row = { blueprintVersionId, id: "session", companyId: s.companyId, candidateId: s.candidateId, applicationId: s.applicationId, version: 0, snapshot: structuredClone(snapshot) }; return structuredClone(row); }),
    update: vi.fn(async (_s, old, snapshot) => { if (!row || row.version !== old.version) return false; row = { ...row, version: row.version + 1, snapshot: structuredClone(snapshot) }; return true; }),
  };
  const store: InterviewStore = { transaction: async work => work(tx) };
  const service = createInterviewSessionService(store);
  return { tx, store, service, setClock: (t: number) => { clock = t; }, getRow: () => row!, setRow: (r: StoredInterview) => { row = r; } };
}
describe("interview persistence service with simulated storage (not PostgreSQL concurrency)", () => {
  it("rechecks authorization before replay lookup and never returns a revoked actor's snapshot", async () => {
    const f = fixture(); await f.service.create(scope, "approved");
    await f.service.execute(scope, "session", 0, start);
    vi.mocked(f.tx.authorize).mockResolvedValue(false);
    vi.mocked(f.tx.find).mockClear(); vi.mocked(f.tx.now).mockClear(); vi.mocked(f.tx.update).mockClear();
    await expect(f.service.execute(scope, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.find).not.toHaveBeenCalled(); expect(f.tx.now).not.toHaveBeenCalled(); expect(f.tx.update).not.toHaveBeenCalled();
    expect(f.getRow().version).toBe(1);
  });
  it("rejects a different authorized application of the same candidate on read and replay", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); await f.service.execute(scope, "session", 0, start);
    vi.mocked(f.tx.authorize).mockResolvedValue(true);
    const other = { ...scope, applicationId: "another-application" };
    await expect(f.service.read(other, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.execute(other, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.update).toHaveBeenCalledTimes(1);
  });
  it("checks scope and revoked permissions for create, read and commands", async () => {
    const f = fixture(); await f.service.create(scope, "approved");
    vi.mocked(f.tx.authorize).mockResolvedValue(false);
    await expect(f.service.create(scope, "approved")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.execute(scope, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.insert).toHaveBeenCalledTimes(1); expect(f.tx.update).not.toHaveBeenCalled();
  });
  it.each(["", " ", undefined])("rejects malformed application scope %j without touching storage", async applicationId => {
    const f = fixture(); const invalid = { ...scope, applicationId } as typeof scope;
    await expect(f.service.create(invalid, "approved")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it("denies creation when a stored blueprint is absent", async () => {
    const f = fixture(); vi.mocked(f.tx.findBlueprint).mockResolvedValue(null); await expect(createInterviewSessionService(f.store).create(scope, "approved")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "REVOKED"] as const)("rejects %s versions without inserting", async status => {
    const f = fixture(); const found = await f.tx.findBlueprint(scope, "approved");
    vi.mocked(f.tx.findBlueprint).mockResolvedValue({ ...found!, version: { ...found!.version, status,
      ...(status === "DRAFT" ? { approvedById: null, approvedAt: null, fingerprint: null } : {}) } });
    await expect(f.service.create(scope, "approved")).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it.each(["fingerprint", "companyId", "jobId", "content"])("rejects invalid binding %s without inserting", async kind => {
    const f = fixture(); const found = (await f.tx.findBlueprint(scope, "approved"))!;
    const version = { ...found.version };
    if (kind === "fingerprint") version.fingerprint = "0".repeat(64);
    if (kind === "companyId") version.companyId = "foreign";
    if (kind === "jobId") version.jobId = "foreign";
    if (kind === "content") version.blueprint = {};
    vi.mocked(f.tx.findBlueprint).mockResolvedValue({ ...found, version });
    await expect(f.service.create(scope, "approved")).rejects.toThrow(); expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it("uses the stored blueprint only and rejects content supplied instead of an ID", async () => {
    const f = fixture();
    await expect(f.service.create(scope, blueprint as unknown as string)).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    const row = await f.service.create(scope, "approved"); expect(row.blueprintVersionId).toBe("approved");
    expect(row.snapshot.blueprint).toEqual(blueprint);
    expect(f.tx.insert).toHaveBeenCalledWith(scope, createInterviewSession(blueprint), "approved");
    f.setRow({ ...f.getRow(), blueprintVersionId: null });
    vi.mocked(f.tx.findBlueprint).mockRejectedValue(new Error("must not read blueprint"));
    expect((await f.service.read(scope, row.id)).blueprintVersionId).toBeNull();
    expect((await f.service.execute(scope, row.id, 0, start)).snapshot.status).toBe("IN_PROGRESS");
  });
  it("reserves candidate commands on invited sessions to the candidate service", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); f.setRow({ ...f.getRow(), invitedAt: new Date() });
    await expect(f.service.execute(scope, "session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.update).not.toHaveBeenCalled();
  });
  it("creates, reads and isolates the complete snapshot", async () => {
    const f = fixture(); const created = await f.service.create(scope, "approved");
    created.snapshot.blueprint.questions[0].text = "mutated";
    expect((await f.service.read(scope, created.id)).snapshot).toEqual(createInterviewSession(blueprint));
  });
  it("increments once and replays across new service instances with stale versions", async () => {
    const f = fixture(); await f.service.create(scope, "approved");
    const first = await f.service.execute(scope, "session", 0, start);
    expect(first.version).toBe(1);
    const restarted = createInterviewSessionService(f.store);
    expect(await restarted.execute(scope, "session", 0, start)).toEqual(first);
    expect(f.tx.update).toHaveBeenCalledTimes(1);
    expect(f.tx.find).toHaveBeenLastCalledWith(scope, "session", true);
  });
  it("rejects conflicting IDs, stale versions and failed compare-and-set", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); await f.service.execute(scope, "session", 0, start);
    await expect(f.service.execute(scope, "session", 0, { type: "EXPIRE_INTERVIEW", commandId: "start" })).rejects.toMatchObject({ code: "COMMAND_CONFLICT" });
    const answer = { type: "SUBMIT_ANSWER", commandId: "answer", turnId: "turn-1", answer: "Answer" };
    await expect(f.service.execute(scope, "session", 0, answer)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    vi.mocked(f.tx.update).mockResolvedValueOnce(false);
    await expect(f.service.execute(scope, "session", 1, answer)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(f.getRow().version).toBe(1);
  });
  it("uses store time, rejects late input and retains history on explicit expiry", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); const active = await f.service.execute(scope, "session", 0, start);
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
    const f = fixture(); await f.service.create(scope, "approved"); f.setRow({ ...f.getRow(), candidateId: "other" });
    await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it.each([null, {}, { status: "READY", blueprint, commands: [], extra: true }])("rejects arbitrary JSON %j", value => {
    expect(() => validateStoredInterview(value)).toThrow("INVALID_SNAPSHOT");
  });
  it("revalidates active snapshots, receipts and versions before returning them", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); const active = await f.service.execute(scope, "session", 0, start);
    for (const snapshot of [{ ...active.snapshot, phase: "AWAITING_AI_DECISION" }, { ...active.snapshot, commands: [{ ...active.snapshot.commands[0], fingerprint: "0".repeat(64) }] }]) {
      f.setRow({ ...active, snapshot }); await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
    }
    f.setRow({ ...active, version: 10 }); await expect(f.service.read(scope, "session")).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
  });
  it("accepts reordered JSONB keys and completed snapshots", async () => {
    const f = fixture(); await f.service.create(scope, "approved"); await f.service.execute(scope, "session", 0, start);
    const ended = await f.service.execute(scope, "session", 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" });
    expect(validateStoredInterview(Object.fromEntries(Object.entries(ended.snapshot).reverse()))).toEqual(ended.snapshot);
  });
});
