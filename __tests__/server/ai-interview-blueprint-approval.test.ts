import { describe, expect, it, vi } from "vitest";
import { createInterviewBlueprintService, fingerprintInterviewBlueprint, type BlueprintTransaction, type StoredBlueprintVersion } from "@/lib/ai/ai-interview-blueprint-service";

const scope = { actorId: "actor", companyId: "company", jobId: "job" };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["Reasoning", "Correctness"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
function fixture() {
  let row: StoredBlueprintVersion;
  let sequence = 0;
  const tx: BlueprintTransaction = {
    authorize: vi.fn(async () => true),
    find: vi.fn(async () => structuredClone(row ?? null)),
    insert: vi.fn(async (s, data) => {
      row = { companyId: s.companyId, jobId: s.jobId, id: `v${++sequence}`, createdById: s.actorId, blueprint: structuredClone(data), status: "DRAFT", approvedById: null, approvedAt: null, fingerprint: null, createdAt: new Date(1000) };
      return structuredClone(row);
    }),
    approve: vi.fn(async (s, _id, fingerprint) => {
      row = { ...row, status: "APPROVED", approvedById: s.actorId, approvedAt: new Date(2000), fingerprint };
      return structuredClone(row);
    }),
    revoke: vi.fn(async () => { row = { ...row, status: "REVOKED" }; return structuredClone(row); }),
  };
  const store = { transaction: async <T>(work: (tx: BlueprintTransaction) => Promise<T>) => work(tx) };
  return { tx, store, service: createInterviewBlueprintService(store), get: () => row, patch: (data: Partial<StoredBlueprintVersion>) => { row = { ...row, ...data }; } };
}

describe("blueprint approval service (simulated storage, not SQL concurrency evidence)", () => {
  it("creates independent drafts, validates and snapshots inputs without exposing approval", async () => {
    const f = fixture(); const input = structuredClone(blueprint);
    const row = await f.service.createDraft(scope, input);
    expect(row).toMatchObject({ status: "DRAFT", createdById: "actor", approvedAt: null, approvedById: null, fingerprint: null });
    input.questions[0].text = "Changed input"; row.blueprint.questions[0].text = "Changed return";
    expect(f.get().blueprint).toEqual(blueprint);
    await expect(f.service.readApproved(scope, row.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
    await expect(f.service.revoke(scope, row.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect((await f.service.createDraft(scope, input)).id).not.toBe(row.id);
  });
  it.each([{}, { ...blueprint, approved: true }, { ...blueprint, questions: [] }, { ...blueprint, plan: { ...blueprint.plan, maxQuestions: 0 } }, { ...blueprint, questions: [{ ...blueprint.questions[0], competencyId: "missing" }] }])("rejects invalid drafts without insertion: %j", async input => {
    const f = fixture(); await expect(f.service.createDraft(scope, input)).rejects.toMatchObject({ code: "INVALID_BLUEPRINT" });
    expect(f.tx.insert).not.toHaveBeenCalled();
  });
  it("canonicalizes nested object keys, validates before hashing and preserves ordered arrays", () => {
    function reorder(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reorder);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, val]) => [key, reorder(val)]));
      return value;
    }
    expect(fingerprintInterviewBlueprint(reorder(blueprint))).toBe(fingerprintInterviewBlueprint(blueprint));
    const changed = structuredClone(blueprint); changed.plan.competencies[0].criteria.reverse();
    expect(fingerprintInterviewBlueprint(changed)).not.toBe(fingerprintInterviewBlueprint(blueprint));
    expect(() => fingerprintInterviewBlueprint({ ...blueprint, plan: {} })).toThrow("INVALID_BLUEPRINT");
  });
  it("records approval once and preserves audit data on replays by another authorized recruiter", async () => {
    const f = fixture(); const draft = await f.service.createDraft(scope, blueprint);
    const approved = await f.service.approve(scope, draft.id);
    expect(approved).toMatchObject({ status: "APPROVED", approvedById: scope.actorId, approvedAt: new Date(2000), fingerprint: fingerprintInterviewBlueprint(blueprint) });
    expect(f.tx.find).toHaveBeenLastCalledWith(scope, draft.id, true);
    expect(await createInterviewBlueprintService(f.store).approve({ ...scope, actorId: "other-approved-recruiter" }, draft.id)).toEqual(approved);
    expect(f.tx.approve).toHaveBeenCalledTimes(1);
    expect(await f.service.readApproved(scope, draft.id)).toEqual(approved);
    approved.blueprint.questions[0].text = "Mutated output";
    expect((await f.service.readApproved(scope, draft.id)).blueprint).toEqual(blueprint);
  });
  it("revokes idempotently, keeps original audit and forbids reapproval", async () => {
    const f = fixture(); const draft = await f.service.createDraft(scope, blueprint);
    const approved = await f.service.approve(scope, draft.id);
    const revoked = await f.service.revoke(scope, draft.id);
    expect(revoked).toEqual({ ...approved, status: "REVOKED" });
    expect(await f.service.revoke(scope, draft.id)).toEqual(revoked);
    expect(f.tx.revoke).toHaveBeenCalledTimes(1);
    await expect(f.service.readApproved(scope, draft.id)).rejects.toMatchObject({ code: "NOT_APPROVED" });
    await expect(f.service.approve(scope, draft.id)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
  it.each(["content", "hash", "invalid-json", "missing-audit", "wrong-time"])("detects corrupted approved records on read and approval replay: %s", async kind => {
    const f = fixture(); const row = await f.service.createDraft(scope, blueprint); await f.service.approve(scope, row.id);
    if (kind === "content") f.patch({ blueprint: { ...blueprint, questions: [{ ...blueprint.questions[0], text: "Altered" }] } });
    if (kind === "hash") f.patch({ fingerprint: "a".repeat(64) });
    if (kind === "invalid-json") f.patch({ blueprint: {} });
    if (kind === "missing-audit") f.patch({ approvedById: null });
    if (kind === "wrong-time") f.patch({ approvedAt: new Date(0) });
    await expect(f.service.readApproved(scope, row.id)).rejects.toMatchObject({ code: "INTEGRITY_ERROR" });
    await expect(f.service.approve(scope, row.id)).rejects.toMatchObject({ code: "INTEGRITY_ERROR" });
    expect(f.tx.approve).toHaveBeenCalledTimes(1);
  });
  it("rechecks authorization before all operations including idempotent approval and revocation", async () => {
    const f = fixture(); const row = await f.service.createDraft(scope, blueprint); await f.service.approve(scope, row.id);
    vi.mocked(f.tx.authorize).mockResolvedValue(false); vi.mocked(f.tx.find).mockClear();
    for (const operation of [() => f.service.createDraft(scope, blueprint), () => f.service.readApproved(scope, row.id), () => f.service.approve(scope, row.id), () => f.service.revoke(scope, row.id)]) {
      await expect(operation()).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(f.tx.find).not.toHaveBeenCalled(); expect(f.get().status).toBe("APPROVED");
  });
  it("rejects corrupted draft audit metadata instead of blessing it", async () => {
    const f = fixture(); const draft = await f.service.createDraft(scope, blueprint);
    f.patch({ approvedById: scope.actorId });
    await expect(f.service.approve(scope, draft.id)).rejects.toMatchObject({ code: "INTEGRITY_ERROR" });
    expect(f.tx.approve).not.toHaveBeenCalled();
  });
  it("rejects revoked authorization after waiting for a row lock", async () => {
    const f = fixture(); const row = await f.service.createDraft(scope, blueprint);
    vi.mocked(f.tx.authorize).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(f.service.approve(scope, row.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.approve).not.toHaveBeenCalled();
  });
  it.each([{ companyId: "foreign" }, { jobId: "another-job" }, { id: "another-id" }])("defends against out-of-scope storage results: %j", async patch => {
    const f = fixture(); const row = await f.service.createDraft(scope, blueprint); f.patch(patch);
    await expect(f.service.approve(scope, row.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.approve).not.toHaveBeenCalled();
  });
  it("handles unknown IDs, malformed scope and failed compare-and-set safely", async () => {
    const f = fixture(); await expect(f.service.approve(scope, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.service.createDraft({ ...scope, actorId: " " }, blueprint)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const row = await f.service.createDraft(scope, blueprint);
    vi.mocked(f.tx.approve).mockResolvedValueOnce(null);
    await expect(f.service.approve(scope, row.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.get().status).toBe("DRAFT");
    await f.service.approve(scope, row.id); vi.mocked(f.tx.revoke).mockResolvedValueOnce(null);
    await expect(f.service.revoke(scope, row.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.get().status).toBe("APPROVED");
  });
});
