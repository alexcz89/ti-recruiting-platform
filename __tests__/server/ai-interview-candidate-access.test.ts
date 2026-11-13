import { describe, expect, it, vi } from "vitest";
import { createCandidateInterviewService } from "@/lib/ai/ai-interview-candidate-service";
import { createInterviewInvitationService, isInterviewApplicationEligible, type InterviewApplication, type InterviewInvitation, type InvitationTransaction } from "@/lib/ai/ai-interview-invitation-service";
import { fingerprintInterviewBlueprint } from "@/lib/ai/ai-interview-blueprint-service";

const scope = { actorId: "recruiter", companyId: "company", candidateId: "candidate", applicationId: "application" };
const blueprint = { plan: { roleTitle: "Developer", seniority: "MID", techStack: ["TS"], competencies: [{ id: "c", name: "Core", criteria: ["SECRET_RUBRIC"], weight: 100 }], timeLimitMinutes: 10, maxQuestions: 3, maxFollowUpsPerQuestion: 1 }, questions: [{ id: "q", competencyId: "c", text: "Explain transactions", order: 0 }] };
const app: InterviewApplication = { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW", stateVersion: 1, hiredAt: null, rejectedAt: null, rejectionEmailSent: false, jobStatus: "OPEN" };
const issue = { blueprintVersionId: "approved", requestId: "request", expiresAt: 100_000 };
const start = { type: "START_INTERVIEW", commandId: "start" };
function fixture() {
  let row: InterviewInvitation | null = null; let now = 1000; let actor: string | null = "candidate";
  const tx: InvitationTransaction = {
    authorizeCancellation: vi.fn(async () => true),
    sessions: {
      authorize: vi.fn(async () => true), now: vi.fn(async () => now), find: vi.fn(async () => structuredClone(row)),
      findBlueprint: vi.fn(async () => ({ jobId: "job", version: { id: "approved", companyId: "company", jobId: "job", blueprint, status: "APPROVED" as const, createdById: "recruiter", approvedById: "recruiter", approvedAt: new Date(1), createdAt: new Date(0), fingerprint: fingerprintInterviewBlueprint(blueprint) } })),
      insert: vi.fn(async (s, snapshot, blueprintVersionId) => {
        row = { id: "session", companyId: s.companyId, candidateId: s.candidateId, applicationId: s.applicationId, blueprintVersionId, version: 0, snapshot: structuredClone(snapshot), invitedById: null, invitedAt: null, invitationExpiresAt: null, invitationCancelledAt: null, invitationCancelledById: null, invitationRequestId: null, invitationFingerprint: null };
        return structuredClone(row);
      }),
      update: vi.fn(async (_s, old, snapshot) => { if (!row || old.version !== row.version) return false; row = { ...row, version: row.version + 1, snapshot: structuredClone(snapshot) }; return true; }),
    },
    application: vi.fn(async () => structuredClone(app)), lockRequest: vi.fn(async () => undefined),
    request: vi.fn(async (_company, requestId) => row?.invitationRequestId === requestId ? structuredClone(row) : null),
    find: vi.fn(async () => structuredClone(row)),
    candidate: vi.fn(async actor => actor === "candidate" ? structuredClone(row) : null),
    stamp: vi.fn(async (s, _id, requestId, fingerprint, expiresAt) => {
      row = { ...row!, invitedById: s.actorId, invitedAt: new Date(now), invitationExpiresAt: expiresAt, invitationRequestId: requestId, invitationFingerprint: fingerprint }; return structuredClone(row);
    }),
    cancel: vi.fn(async s => { row = { ...row!, invitationCancelledAt: new Date(now), invitationCancelledById: s.actorId }; }),
  };
  const store = { transaction: async <T>(work: (t: InvitationTransaction) => Promise<T>) => {
    const previous = structuredClone(row); try { return await work(tx); } catch (error) { row = previous; throw error; }
  } };
  return { tx, recruiter: createInterviewInvitationService(store), candidate: createCandidateInterviewService(store, async () => actor), actor: (id: string | null) => { actor = id; }, get: () => row!, set: (r: InterviewInvitation) => { row = r; }, clock: (t: number) => { now = t; } };
}
describe("candidate interview access using simulated transactions (not SQL concurrency evidence)", () => {
  it("issues atomically, replays once, and rejects request ID reuse with different content", async () => {
    const f = fixture(); expect(await f.recruiter.issue(scope, issue)).toEqual({ id: "session" });
    expect(await f.recruiter.issue(scope, issue)).toEqual({ id: "session" });
    expect(f.tx.sessions.insert).toHaveBeenCalledTimes(1);
    await expect(f.recruiter.issue(scope, { ...issue, expiresAt: 200_000 })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
  it("rolls back session creation if invitation persistence fails", async () => {
    const f = fixture(); vi.mocked(f.tx.stamp).mockRejectedValue(new Error("failure"));
    await expect(f.recruiter.issue(scope, issue)).rejects.toThrow("failure"); expect(f.get()).toBeNull();
  });
  it("rejects unapproved recruiter before persistence and cancellation", async () => {
    const f = fixture(); vi.mocked(f.tx.sessions.authorize).mockResolvedValue(false); vi.mocked(f.tx.authorizeCancellation).mockResolvedValue(false);
    await expect(f.recruiter.issue(scope, issue)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(f.recruiter.cancel(scope, "session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.tx.sessions.insert).not.toHaveBeenCalled();
  });
  it.each(["EXPIRED", "CLOSED_JOB", "INELIGIBLE"])("rejects new invitations: %s", async kind => {
    const f = fixture(); if (kind === "EXPIRED") f.clock(issue.expiresAt);
    if (kind === "CLOSED_JOB") vi.mocked(f.tx.application).mockResolvedValue({ ...app, jobStatus: "CLOSED" });
    if (kind === "INELIGIBLE") vi.mocked(f.tx.application).mockResolvedValue({ ...app, status: "HIRED" });
    await expect(f.recruiter.issue(scope, issue)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(f.get()).toBeNull();
  });
  it("only permits the correct candidate and projects an explicit safe field set", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue);
    f.actor("other-candidate");
    await expect(f.candidate.read("session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.actor("candidate");
    const view = await f.candidate.execute("session", 0, start);
    expect(view.currentQuestion).toEqual({ turnId: "turn-1", text: "Explain transactions", kind: "MAIN" });
    const json = JSON.stringify(view);
    for (const secret of ["SECRET_RUBRIC", "blueprint", "competencyId", "mainQuestionId", "approvedById", "commands", "fingerprint", "recruiter"]) expect(json).not.toContain(secret);
    expect(await f.candidate.execute("session", 0, start)).toEqual(view);
    expect(f.get().version).toBe(1);
  });
  it.each(["APPLY_AI_DECISION", "EXPIRE_INTERVIEW"])("rejects candidate command %s before writing", async type => {
    const f = fixture(); await f.recruiter.issue(scope, issue); await f.candidate.execute("session", 0, start);
    await expect(f.candidate.execute("session", 1, { type, commandId: "privileged", ...(type === "APPLY_AI_DECISION" ? { decision: { type: "ADVANCE", turnId: "turn-1" } } : {}) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.get().version).toBe(1);
  });
  it("obtains identity anew on every call and rejects identity fields injected into commands", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue); await f.candidate.execute("session", 0, start);
    f.actor(null); await expect(f.candidate.read("session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.actor("candidate");
    await expect(f.candidate.execute("session", 1, { type: "SKIP_QUESTION", commandId: "spoof", turnId: "turn-1", candidateId: "other" })).rejects.toThrow();
    expect(f.get().version).toBe(1);
  });
  it("allows own answers/skips, handles stale versions, and retains the engine's follow-up boundary", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue); await f.candidate.execute("session", 0, start);
    const answer = { type: "SUBMIT_ANSWER", commandId: "answer", turnId: "turn-1", answer: "My answer" };
    await expect(f.candidate.execute("session", 0, answer)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    const answered = await f.candidate.execute("session", 1, answer);
    expect(answered.answers[0].answer).toBe("My answer"); expect(answered.phase).toBe("AWAITING_AI_DECISION");
    await expect(f.candidate.execute("session", 2, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).rejects.toMatchObject({ code: "INVALID_PHASE" });
  });
  it("rejects a start exactly at invite expiry but retains the interview deadline after start", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue); f.clock(issue.expiresAt);
    await expect(f.candidate.execute("session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.clock(1000); await f.candidate.execute("session", 0, start); f.clock(issue.expiresAt + 1);
    expect((await f.candidate.execute("session", 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).status).toBe("COMPLETED");
  });
  it("cancels idempotently and rejects future commands/replays while preserving snapshot", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue); await f.candidate.execute("session", 0, start);
    const snapshot = structuredClone(f.get().snapshot); await f.recruiter.cancel(scope, "session"); await f.recruiter.cancel(scope, "session");
    expect(f.tx.cancel).toHaveBeenCalledTimes(1);
    await expect(f.candidate.execute("session", 0, start)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.get().snapshot).toEqual(snapshot);
  });
  it("denies historical sessions without invitation and blocks new actions when application eligibility changes", async () => {
    const f = fixture(); await f.recruiter.issue(scope, issue); const issued = structuredClone(f.get());
    f.set({ ...issued, invitedAt: null }); await expect(f.candidate.read("session")).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.set(issued); await f.candidate.execute("session", 0, start);
    vi.mocked(f.tx.application).mockResolvedValue({ ...app, disposition: "HOLD" });
    await expect(f.candidate.execute("session", 1, { type: "SKIP_QUESTION", commandId: "skip", turnId: "turn-1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(f.get().version).toBe(1);
  });
});
describe("interview issuance eligibility independent of read feature flags", () => {
  it.each([
    { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW" },
    { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "MAYBE" },
    { stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
    { stage: null, disposition: null, stateVersion: 0, status: "REVIEWING", recruiterInterest: "MAYBE" },
    { stage: null, disposition: null, stateVersion: 0, status: "SUBMITTED", recruiterInterest: "REVIEW" },
  ] as Partial<InterviewApplication>[])("accepts safe representation %j", patch => expect(isInterviewApplicationEligible({ ...app, ...patch })).toBe(true));
  it.each([
    { stage: null }, { disposition: null }, { stateVersion: -1 }, { status: "HIRED" },
    { status: "REJECTED" }, { recruiterInterest: "REJECTED" }, { disposition: "HOLD" },
    { hiredAt: new Date() }, { rejectedAt: new Date() }, { rejectionEmailSent: true },
    { stage: "CLOSED", disposition: "WITHDRAWN" }, { stage: "CLOSED", disposition: "CANCELLED" },
    { stage: null, disposition: null, stateVersion: 0, status: "REVIEWING", recruiterInterest: "ACCEPTED" },
  ] as Partial<InterviewApplication>[])("rejects unsafe representation %j", patch => expect(isInterviewApplicationEligible({ ...app, ...patch })).toBe(false));
});
