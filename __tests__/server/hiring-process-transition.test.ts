import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CanonicalHiringProcessDisabledError,
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

describe("transitionApplication", () => {
  beforeEach(() => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults the feature flag to off", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "");
    const store = new MemoryTransitionStore();

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
    ).rejects.toBeInstanceOf(CanonicalHiringProcessDisabledError);
    expect(store.transactionCount).toBe(0);
  });

  it("enables the canonical transition path only when the flag is true", async () => {
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

  it("leaves legacy behavior untouched while the feature flag is off", async () => {
    vi.stubEnv("CANONICAL_HIRING_PROCESS_ENABLED", "false");
    const store = new MemoryTransitionStore();

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
    ).rejects.toBeInstanceOf(CanonicalHiringProcessDisabledError);

    expect(store.transactionCount).toBe(0);
    expect(store.current).toEqual(application());
    expect(store.events).toEqual([]);
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
