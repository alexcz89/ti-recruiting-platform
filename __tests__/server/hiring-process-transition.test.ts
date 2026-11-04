import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canStartReview } from "@/lib/hiring-process/start-review-eligibility";
import { InvalidApplicationTransitionError } from "@/lib/hiring-process/rules";
import { RECRUITING_STATES, type RecruitingState } from "@/lib/hiring-process/recruiter-state";
import { getRecruitingPresentation } from "@/lib/hiring-process/recruiting-presentation";

import {

  CanonicalStateUnavailableError,
  ConcurrentApplicationTransitionError,
  IdempotencyKeyConflictError,
  UnauthorizedApplicationTransitionError,
  transitionApplication,
  type ApplicationTransitionStore,
  type StoredApplicationEvent,
  type TransitionApplicationRecord,
  type TransitionTransaction,
} from "@/lib/hiring-process/transition-application";

function application(
  overrides: Partial<TransitionApplicationRecord> = {},
): TransitionApplicationRecord {
  return {
    id: "application-1",
    companyId: "company-1",
    stage: "APPLIED",
    disposition: "ACTIVE",
    stateVersion: 0,
    status: "SUBMITTED",
    recruiterInterest: "REVIEW",
    reviewingAt: null,
    interviewAt: null,
    offerAt: null,
    hiredAt: null,
    rejectedAt: null,
    rejectionEmailSent: false,
    ...overrides,
  };
}

class MemoryTransitionStore implements ApplicationTransitionStore {
  current: TransitionApplicationRecord;
  events: StoredApplicationEvent[] = [];
  transactionCount = 0;
  failEventWrite = false;

  constructor(initial = application()) {
    this.current = initial;
  }

  async transaction<T>(work: (tx: TransitionTransaction) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    let draft = { ...this.current };
    const draftEvents = this.events.map((event) => ({ ...event }));
    const tx: TransitionTransaction = {
      findApplication: async (applicationId) =>
        draft.id === applicationId ? { ...draft } : null,
      findEventByIdempotencyKey: async (companyId, applicationId, key) =>
        draftEvents.find(
          (event) =>
            event.companyId === companyId &&
            event.applicationId === applicationId &&
            event.idempotencyKey === key,
        ) ?? null,
      isActorAuthorized: async (actor, companyId) =>
        actor.type === "SYSTEM" ||
        actor.type === "IMPORT" ||
        (actor.type === "ADMIN" && actor.id === "admin-1") ||
        (actor.type === "RECRUITER" &&
          actor.id === "recruiter-1" &&
          actor.companyId === companyId),
      updateApplicationIfVersion: async (input) => {
        if (
          draft.id !== input.applicationId ||
          draft.stateVersion !== input.expectedVersion
        ) {
          return false;
        }
        draft = { ...draft, ...input.changes };
        return true;
      },
      createEvent: async (event) => {
        if (this.failEventWrite) throw new Error("event write failed");
        const stored: StoredApplicationEvent = {
          id: `event-${draftEvents.length + 1}`,
          recordedAt: new Date("2026-09-30T12:00:00.000Z"),
          ...event,
        };
        draftEvents.push(stored);
        return stored;
      },
    };

    const result = await work(tx);
    this.current = draft;
    this.events = draftEvents;
    return result;
  }
}

const recruiter = {
  type: "RECRUITER" as const,
  id: "recruiter-1",
  companyId: "company-1",
};

const stateRows: Record<RecruitingState, Partial<TransitionApplicationRecord>> = {
  APPLIED: { stage: "APPLIED", disposition: "ACTIVE", status: "SUBMITTED", recruiterInterest: "REVIEW" },
  REVIEW: { stage: "REVIEW", disposition: "ACTIVE", status: "REVIEWING", recruiterInterest: "REVIEW" },
  INTERVIEW: { stage: "INTERVIEW", disposition: "ACTIVE", status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
  OFFER: { stage: "OFFER", disposition: "ACTIVE", status: "OFFER", recruiterInterest: "ACCEPTED" },
  REJECTED: { stage: "CLOSED", disposition: "REJECTED", status: "REJECTED", recruiterInterest: "REJECTED", rejectedAt: new Date("2026-10-01"), rejectionEmailSent: true },
  HIRED: { stage: "CLOSED", disposition: "HIRED", status: "HIRED", recruiterInterest: "ACCEPTED", hiredAt: new Date("2026-10-01") },
  WITHDRAWN: { stage: "CLOSED", disposition: "WITHDRAWN", status: "SUBMITTED", recruiterInterest: "REVIEW" },
  CANCELLED: { stage: "CLOSED", disposition: "CANCELLED", status: "SUBMITTED", recruiterInterest: "REVIEW" },
  HOLD: { stage: "REVIEW", disposition: "HOLD", status: "REVIEWING", recruiterInterest: "REVIEW" },
};

describe("explicit recruiter destination transaction", () => {
  it("reinicia las 72 horas y limpia las reservas al volver a Rechazado", async () => {
    const store = new MemoryTransitionStore(
      application(stateRows.REVIEW)
    );

    // Simular una reserva antigua que no debe conservarse.
    Object.assign(store.current, {
      rejectionEmailLeaseUntil: new Date("2026-11-02T12:00:00.000Z"),
      rejectionEmailLeaseToken: "old-lease",
      rejectionEmailAttemptStartedAt: new Date("2026-11-01T10:00:00.000Z"),
    });

    const firstRejection = new Date("2026-11-02T10:00:00.000Z");
    const reopenedAt = new Date("2026-11-03T15:00:00.000Z");
    const secondRejection = new Date("2026-11-04T11:00:00.000Z");

    // 1. Entrar a Rechazado por primera vez.
    await transitionApplication(
      {
        applicationId: store.current.id,
        actor: recruiter,
        expectedVersion: 0,
        recruitingDestination: "REJECTED",
        reasonCode: "CORRECTION",
        happenedAt: firstRejection,
        idempotencyKey: "first-rejection",
      },
      { store }
    );

    expect(store.current).toMatchObject({
      stage: "CLOSED",
      disposition: "REJECTED",
      rejectedAt: firstRejection,
      rejectionEmailSent: false,
      rejectionEmailLeaseUntil: null,
      rejectionEmailLeaseToken: null,
      rejectionEmailAttemptStartedAt: null,
    });

    // Simular una reserva activa durante este rechazo.
    Object.assign(store.current, {
      rejectionEmailLeaseUntil: new Date("2026-11-02T10:10:00.000Z"),
      rejectionEmailLeaseToken: "active-lease",
      rejectionEmailAttemptStartedAt: new Date("2026-11-02T10:05:00.000Z"),
    });

    // 2. Sacar al candidato de Rechazado.
    await transitionApplication(
      {
        applicationId: store.current.id,
        actor: recruiter,
        expectedVersion: 1,
        recruitingDestination: "REVIEW",
        reasonCode: "RECONSIDERED",
        happenedAt: reopenedAt,
        idempotencyKey: "reopen-rejection",
      },
      { store }
    );

    expect(store.current).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      rejectedAt: null,
      rejectionEmailSent: false,
      rejectionEmailLeaseUntil: null,
      rejectionEmailLeaseToken: null,
      rejectionEmailAttemptStartedAt: null,
    });

    // 3. Rechazar al mismo candidato nuevamente.
    await transitionApplication(
      {
        applicationId: store.current.id,
        actor: recruiter,
        expectedVersion: 2,
        recruitingDestination: "REJECTED",
        reasonCode: "CORRECTION",
        happenedAt: secondRejection,
        idempotencyKey: "second-rejection",
      },
      { store }
    );

    expect(store.current).toMatchObject({
      stage: "CLOSED",
      disposition: "REJECTED",
      stateVersion: 3,
      rejectedAt: secondRejection,
      rejectionEmailSent: false,
      rejectionEmailLeaseUntil: null,
      rejectionEmailLeaseToken: null,
      rejectionEmailAttemptStartedAt: null,
    });

    // El segundo rechazo debe tener una fecha distinta.
    expect(secondRejection.getTime()).toBeGreaterThan(
      firstRejection.getTime()
    );

    // Los tres movimientos deben quedar auditados.
    expect(store.events).toHaveLength(3);
  });
  it.each(RECRUITING_STATES.filter(from => from !== "HIRED").flatMap(from => RECRUITING_STATES.filter(to => to !== from).map(to => ({ from, to }))))("moves $from directly to $to with one audited write", async ({ from, to }) => {
    const store = new MemoryTransitionStore(application(stateRows[from]));
    const before = { ...store.current };
    const input = { applicationId: before.id, actor: recruiter, expectedVersion: 0, idempotencyKey: `${from}-${to}`, recruitingDestination: to, reasonCode: "CORRECTION", reasonText: "Cambio de prueba" };
    const result = await transitionApplication(input, { store });
    expect(result.state.stateVersion).toBe(1);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ actorId: recruiter.id, companyId: recruiter.companyId, reasonCode: "CORRECTION", fromStage: before.stage, fromDisposition: before.disposition });
    expect(store.events[0].metadata).toMatchObject({ operation: "SET_RECRUITING_STATE", destination: to,
      previousState: { status: before.status, hiredAt: before.hiredAt?.toISOString() ?? null, rejectedAt: before.rejectedAt?.toISOString() ?? null, rejectionEmailSent: before.rejectionEmailSent } });
    for (const reads of [true, false]) {
      const view = getRecruitingPresentation(store.current, reads);
      expect(view.section === "ACTIVE" ? view.column : view.section === "CLOSED" ? view.outcome : view.section).toBe(to);
    }
    if (to !== "REJECTED") expect(store.current.rejectedAt).toBeNull();
    else expect(store.current.rejectedAt).toBeInstanceOf(Date);
    if (to !== "HIRED") expect(store.current.hiredAt).toBeNull();
    else expect(store.current.hiredAt).toBeInstanceOf(Date);
    const after = { ...store.current };
    expect((await transitionApplication(input, { store })).replayed).toBe(true);
    expect(store.current).toEqual(after);
    expect(store.events).toHaveLength(1);
  });

  it.each(["APPLIED", "REVIEW", "INTERVIEW", "OFFER", "REJECTED"] as const)("imports only the touched deterministic legacy $%s row, atomically", async from => {
    const store = new MemoryTransitionStore(application({ ...stateRows[from], stage: null, disposition: null }));
    const to = from === "OFFER" ? "REVIEW" : "OFFER";
    await transitionApplication({ applicationId: store.current.id, actor: recruiter, expectedVersion: 0, recruitingDestination: to, reasonCode: "RECONSIDERED", idempotencyKey: "legacy-move" }, { store });
    expect(store.current).toMatchObject({ stage: to, disposition: "ACTIVE", stateVersion: 1 });
    expect(store.events[0]).toMatchObject({ fromStage: null, fromDisposition: null, metadata: { legacyImported: true } });
  });

  describe.each([true, false])("HIRED terminal, canonical source=%s", canonical => {
    it.each(RECRUITING_STATES)("rejects a new command to %s without changing state or audit history", async destination => {
      for (const actor of [recruiter, { type: "ADMIN" as const, id: "admin-1" }]) {
        const store = new MemoryTransitionStore(application({ ...stateRows.HIRED, ...(canonical ? {} : { stage: null, disposition: null }) }));
        const before = { ...store.current };
        await expect(transitionApplication({ applicationId: before.id, actor, expectedVersion: 0,
          recruitingDestination: destination, reasonCode: "CORRECTION", idempotencyKey: `hired-${destination}` }, { store }))
          .rejects.toBeInstanceOf(InvalidApplicationTransitionError);
        expect(store.current).toEqual(before);
        expect(store.events).toEqual([]);
      }
    });
  });

  it("keeps hiring command replay authorized and idempotent after HIRED becomes terminal", async () => {
    const store = new MemoryTransitionStore(application(stateRows.OFFER));
    const command = { applicationId: store.current.id, actor: recruiter, expectedVersion: 0,
      recruitingDestination: "HIRED" as const, idempotencyKey: "hire-once" };
    await transitionApplication(command, { store });
    const hired = { ...store.current };
    expect((await transitionApplication(command, { store })).replayed).toBe(true);
    await expect(transitionApplication({ ...command, actor: { ...recruiter, companyId: "other-company" } }, { store })).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);
    await expect(transitionApplication({ ...command, recruitingDestination: "REVIEW", reasonCode: "CORRECTION" }, { store })).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    await expect(transitionApplication({ ...command, idempotencyKey: "stale-command" }, { store })).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
    await expect(transitionApplication({ ...command, expectedVersion: 1, idempotencyKey: "new-command", recruitingDestination: "REVIEW", reasonCode: "CORRECTION" }, { store })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(store.current).toEqual(hired);
    expect(store.events).toHaveLength(1);
  });

  it.each([
    { from: "OFFER", to: "REVIEW" }, { from: "INTERVIEW", to: "APPLIED" },
    { from: "REJECTED", to: "OFFER" }, { from: "HIRED", to: "REVIEW" },
    { from: "WITHDRAWN", to: "INTERVIEW" }, { from: "CANCELLED", to: "APPLIED" },
  ] as const)("rejects $from → $to without a reason, with no write or event", async ({ from, to }) => {
    const store = new MemoryTransitionStore(application(stateRows[from]));
    const before = { ...store.current };
    await expect(transitionApplication({ applicationId: before.id, actor: recruiter, expectedVersion: 0, recruitingDestination: to }, { store })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(store.current).toEqual(before);
    expect(store.events).toEqual([]);
  });
  it.each([
    { stage: null, disposition: null, status: "SUBMITTED", recruiterInterest: "ACCEPTED" },
    { stage: null, disposition: null, stateVersion: 2 }, { stage: null },
    { status: "HIRED" }, { hiredAt: new Date() }, { rejectedAt: new Date() },
    { stage: "OFFER", status: "INTERVIEW", recruiterInterest: "ACCEPTED" },
    { stage: "CLOSED", disposition: "HIRED", status: "REJECTED", recruiterInterest: "REJECTED" },
  ] as const)("preserves ambiguous or contradictory historical source %j", async patch => {
    const store = new MemoryTransitionStore(application(patch));
    const before = { ...store.current };
    await expect(transitionApplication({ applicationId: before.id, actor: recruiter, expectedVersion: before.stateVersion, recruitingDestination: "OFFER" }, { store })).rejects.toThrow();
    expect(store.current).toEqual(before); expect(store.events).toEqual([]);
  });
  it("does not rewrite an unchanged destination or accept an outdated command", async () => {
    const store = new MemoryTransitionStore();
    const input = { applicationId: store.current.id, actor: recruiter, expectedVersion: 0, recruitingDestination: "APPLIED" as const };
    await expect(transitionApplication(input, { store })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    await expect(transitionApplication({ ...input, recruitingDestination: "OFFER", expectedVersion: 1 }, { store })).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
    expect(store.events).toHaveLength(0);
  });
  it("rejects a competing version and reused command ID with a different destination", async () => {
    const store = new MemoryTransitionStore();
    const input = { applicationId: store.current.id, actor: recruiter, expectedVersion: 0, recruitingDestination: "OFFER" as const, idempotencyKey: "once" };
    await transitionApplication(input, { store });
    const after = { ...store.current };
    await expect(transitionApplication({ ...input, recruitingDestination: "INTERVIEW" }, { store })).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    await expect(transitionApplication({ ...input, idempotencyKey: "other-command" }, { store })).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
    expect(store.current).toEqual(after); expect(store.events).toHaveLength(1);
  });
  it("rolls legacy conversion back if the audit event cannot be written", async () => {
    const store = new MemoryTransitionStore(application({ stage: null, disposition: null }));
    store.failEventWrite = true;
    const before = { ...store.current };
    await expect(transitionApplication({ applicationId: before.id, actor: recruiter, expectedVersion: 0, recruitingDestination: "HOLD" }, { store })).rejects.toThrow("event write failed");
    expect(store.current).toEqual(before); expect(store.events).toEqual([]);
  });
  it.each([
    { ...recruiter, companyId: "company-other" }, { ...recruiter, id: "suspended-user" },
    { type: "CANDIDATE", id: "candidate" }, { type: "SYSTEM" },
  ] as const)("rejects unauthorized or cross-company actor %j", async actor => {
    const store = new MemoryTransitionStore();
    await expect(transitionApplication({ applicationId: store.current.id, actor, expectedVersion: 0, recruitingDestination: "HIRED" }, { store })).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);
    expect(store.events).toEqual([]); expect(store.current.stateVersion).toBe(0);
  });
  it("preserves preselection when pausing and resuming REVIEW", async () => {
    const store = new MemoryTransitionStore(application({ ...stateRows.REVIEW, recruiterInterest: "MAYBE" }));
    await transitionApplication({ applicationId: store.current.id, actor: recruiter, expectedVersion: 0, recruitingDestination: "HOLD" }, { store });
    await transitionApplication({ applicationId: store.current.id, actor: recruiter, expectedVersion: 1, recruitingDestination: "REVIEW" }, { store });
    expect(store.current.recruiterInterest).toBe("MAYBE");
  });
});

describe("transitionApplication", () => {
  const assertReviewSource = (row: TransitionApplicationRecord) => {
    if (!canStartReview(row)) throw new InvalidApplicationTransitionError("Incompatible START_REVIEW source");
  };

  it.each([
    { status: "HIRED" as const, recruiterInterest: "ACCEPTED" as const },
    { status: "REJECTED" as const }, { recruiterInterest: "REJECTED" as const },
    { status: "OFFER" as const }, { hiredAt: new Date("2026-10-01") },
    { rejectedAt: new Date("2026-10-01") }, { offerAt: new Date("2026-10-01") },
    { interviewAt: new Date("2026-10-01") }, { rejectionEmailSent: true },
  ])("rejects inconsistent APPLIED/ACTIVE snapshot %j without mutations or events", async (patch) => {
    const store = new MemoryTransitionStore(application(patch));
    const before = { ...store.current };
    await expect(transitionApplication({ applicationId: before.id, targetStage: "REVIEW", targetDisposition: "ACTIVE",
      expectedVersion: 0, actor: recruiter, idempotencyKey: "incompatible-review",
    }, { store, assertSource: assertReviewSource })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(store.current).toEqual(before);
    expect(store.events).toEqual([]);
  });

  it("checks the transactional source after a clean earlier eligibility read and preserves legitimate command replay", async () => {
    const store = new MemoryTransitionStore();
    expect(canStartReview(store.current)).toBe(true);
    store.current.status = "HIRED";
    const input = { applicationId: store.current.id, targetStage: "REVIEW" as const, targetDisposition: "ACTIVE" as const,
      expectedVersion: 0, actor: recruiter, idempotencyKey: "guarded-start-review" };
    await expect(transitionApplication(input, { store, assertSource: assertReviewSource })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(store.current.status).toBe("HIRED");
    expect(store.events).toHaveLength(0);
    store.current.status = "SUBMITTED";
    await transitionApplication(input, { store, assertSource: assertReviewSource });
    const after = { ...store.current };
    const replay = await transitionApplication(input, { store, assertSource: assertReviewSource });
    expect(replay.replayed).toBe(true);
    expect(store.current).toEqual(after);
    expect(store.events).toHaveLength(1);
    await expect(transitionApplication({ ...input, expectedVersion: 1, idempotencyKey: "new-invalid-review" },
      { store, assertSource: assertReviewSource })).rejects.toBeInstanceOf(InvalidApplicationTransitionError);
    expect(store.events).toHaveLength(1);
  });
  beforeEach(() => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps canonical transitions usable when the rollout flag is unset", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "");
    const store = new MemoryTransitionStore();

    const result = await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
      },
      { store },
    );

    expect(result.state.stage).toBe("REVIEW");
    expect(store.transactionCount).toBe(1);
    expect(store.events).toHaveLength(1);
  });

  it("executes the canonical transition path when the rollout flag is true", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
    const store = new MemoryTransitionStore();

    const result = await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
      },
      { store },
    );

    expect(result.state.stage).toBe("REVIEW");
    expect(store.events).toHaveLength(1);
  });

  it("keeps canonical transitions usable after the rollout flag is turned off", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const store = new MemoryTransitionStore();

    const result = await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
      },
      { store },
    );

    expect(result.state.stage).toBe("REVIEW");
    expect(store.transactionCount).toBe(1);
    expect(store.events).toHaveLength(1);
  });

  it("atomically updates canonical state, safe legacy projection, timestamps and event", async () => {
    const store = new MemoryTransitionStore();
    const happenedAt = new Date("2026-09-30T11:00:00.000Z");

    const result = await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
        happenedAt,
        idempotencyKey: "review-application-1",
      },
      { store },
    );

    expect(result.replayed).toBe(false);
    expect(result.state).toEqual({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 1,
    });
    expect(store.current).toMatchObject({
      stage: "REVIEW",
      disposition: "ACTIVE",
      stateVersion: 1,
      status: "REVIEWING",
      recruiterInterest: "REVIEW",
      reviewingAt: happenedAt,
    });
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      applicationId: "application-1",
      companyId: "company-1",
      actorType: "RECRUITER",
      actorId: "recruiter-1",
      type: "APPLICATION_STAGE_CHANGED",
      fromStage: "APPLIED",
      toStage: "REVIEW",
      fromDisposition: "ACTIVE",
      toDisposition: "ACTIVE",
      visibility: "INTERNAL",
      idempotencyKey: "review-application-1",
    });
  });

  it("rolls back the state when the event write fails", async () => {
    const store = new MemoryTransitionStore();
    store.failEventWrite = true;

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor: recruiter,
        },
        { store },
      ),
    ).rejects.toThrow("event write failed");

    expect(store.current).toEqual(application());
    expect(store.events).toEqual([]);
  });

  it.each([
    { type: "CANDIDATE" as const, id: "candidate-1", companyId: null },
    { type: "RECRUITER" as const, id: "recruiter-2", companyId: "company-2" },
    { type: "RECRUITER" as const, id: "unknown", companyId: "company-1" },
  ])("rejects an unauthorized $type actor", async (actor) => {
    const store = new MemoryTransitionStore();

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor,
        },
        { store },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedApplicationTransitionError);

    expect(store.current).toEqual(application());
    expect(store.events).toEqual([]);
  });

  it("returns the prior result for an idempotent retry without duplicating the event", async () => {
    const store = new MemoryTransitionStore();
    const input = {
      applicationId: "application-1",
      targetStage: "REVIEW" as const,
      expectedVersion: 0,
      actor: recruiter,
      idempotencyKey: "same-command",
    };

    const first = await transitionApplication(input, { store });
    await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "INTERVIEW",
        expectedVersion: 1,
        actor: recruiter,
        idempotencyKey: "next-command",
      },
      { store },
    );
    const retry = await transitionApplication(input, { store });

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.event.id).toBe(first.event.id);
    expect(retry.state).toEqual(first.state);
    expect(retry.legacyProjectionApplied).toBe(first.legacyProjectionApplied);
    expect(store.events).toHaveLength(2);
    expect(store.current.stateVersion).toBe(2);
  });

  it("rejects reuse of an idempotency key for a different command", async () => {
    const store = new MemoryTransitionStore();
    await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
        idempotencyKey: "reused-key",
      },
      { store },
    );

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetDisposition: "REJECTED",
          expectedVersion: 1,
          actor: recruiter,
          idempotencyKey: "reused-key",
        },
        { store },
      ),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);

    expect(store.events).toHaveLength(1);
  });

  it("rejects a stale concurrent transition", async () => {
    const store = new MemoryTransitionStore();
    await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
      },
      { store },
    );

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "INTERVIEW",
          expectedVersion: 0,
          actor: recruiter,
        },
        { store },
      ),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);

    expect(store.current.stage).toBe("REVIEW");
    expect(store.events).toHaveLength(1);
  });

  it("normalizes a PostgreSQL serializable write conflict", async () => {
    const store: ApplicationTransitionStore = {
      transaction: async () => {
        throw Object.assign(new Error("write conflict"), { code: "P2034" });
      },
    };

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor: recruiter,
        },
        { store },
      ),
    ).rejects.toBeInstanceOf(ConcurrentApplicationTransitionError);
  });

  it("does not invent a legacy projection for ASSESSMENT", async () => {
    const store = new MemoryTransitionStore(
      application({
        stage: "REVIEW",
        status: "REVIEWING",
        recruiterInterest: "MAYBE",
      }),
    );

    await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "ASSESSMENT",
        expectedVersion: 0,
        actor: recruiter,
      },
      { store },
    );

    expect(store.current).toMatchObject({
      stage: "ASSESSMENT",
      status: "REVIEWING",
      recruiterInterest: "MAYBE",
    });
  });

  it("requires a structured reason code for a backward transition", async () => {
    const store = new MemoryTransitionStore(
      application({
        stage: "INTERVIEW",
        status: "INTERVIEW",
        recruiterInterest: "ACCEPTED",
      }),
    );

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "REVIEW",
          expectedVersion: 0,
          actor: recruiter,
          reasonText: "private recruiter rationale",
        },
        { store },
      ),
    ).rejects.toThrow("requieren una razón explícita");

    await transitionApplication(
      {
        applicationId: "application-1",
        targetStage: "REVIEW",
        expectedVersion: 0,
        actor: recruiter,
        reasonCode: "RETURN_TO_REVIEW",
        reasonText: "private recruiter rationale",
      },
      { store },
    );

    expect(JSON.stringify(store.events[0])).not.toContain("private recruiter rationale");
    expect(store.events[0].reasonCode).toBe("RETURN_TO_REVIEW");
    expect(store.events[0].metadata).toMatchObject({ reasonTextProvided: true });
  });

  it("requires existing canonical state instead of inferring an ambiguous legacy row", async () => {
    const store = new MemoryTransitionStore(
      application({
        stage: null,
        disposition: null,
        status: "REVIEWING",
        recruiterInterest: "ACCEPTED",
      }),
    );

    await expect(
      transitionApplication(
        {
          applicationId: "application-1",
          targetStage: "INTERVIEW",
          expectedVersion: 0,
          actor: recruiter,
        },
        { store },
      ),
    ).rejects.toBeInstanceOf(CanonicalStateUnavailableError);

    expect(store.events).toEqual([]);
  });
});
