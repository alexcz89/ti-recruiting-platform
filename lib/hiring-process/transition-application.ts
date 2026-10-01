import { createHash } from "node:crypto";

import { applicationEventVisibility, eventTypeForTransition } from "./event-policy";
import { isCanonicalHiringProcessEnabled } from "./feature-flags";
import {
  projectCanonicalStateToLegacy,
  type LegacyApplicationInterest,
  type LegacyApplicationStatus,
} from "./legacy-mapping";
import { planApplicationTransition } from "./rules";
import type {
  ApplicationActorTypeValue,
  ApplicationDispositionValue,
  ApplicationEventTypeValue,
  ApplicationEventVisibilityValue,
  ApplicationStageValue,
} from "./types";

export class CanonicalHiringProcessDisabledError extends Error {
  readonly code = "CANONICAL_HIRING_PROCESS_DISABLED";
  constructor() {
    super("Canonical hiring process is disabled");
    this.name = "CanonicalHiringProcessDisabledError";
  }
}

export class ApplicationNotFoundError extends Error {
  readonly code = "APPLICATION_NOT_FOUND";
  constructor() {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class UnauthorizedApplicationTransitionError extends Error {
  readonly code = "UNAUTHORIZED_APPLICATION_TRANSITION";
  constructor() {
    super("Actor is not authorized to transition this application");
    this.name = "UnauthorizedApplicationTransitionError";
  }
}

export class CanonicalStateUnavailableError extends Error {
  readonly code = "CANONICAL_STATE_UNAVAILABLE";
  constructor() {
    super("Application requires explicit canonical state reconciliation");
    this.name = "CanonicalStateUnavailableError";
  }
}

export class ConcurrentApplicationTransitionError extends Error {
  readonly code = "CONCURRENT_APPLICATION_TRANSITION";
  constructor() {
    super("Application state changed concurrently");
    this.name = "ConcurrentApplicationTransitionError";
  }
}

export class IdempotencyKeyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_CONFLICT";
  constructor() {
    super("Idempotency key was already used for a different transition");
    this.name = "IdempotencyKeyConflictError";
  }
}

export type TransitionActor = {
  type: ApplicationActorTypeValue;
  id?: string | null;
  companyId?: string | null;
};

export type TransitionApplicationRecord = {
  id: string;
  companyId: string;
  stage: ApplicationStageValue | null;
  disposition: ApplicationDispositionValue | null;
  stateVersion: number;
  status: LegacyApplicationStatus;
  recruiterInterest: LegacyApplicationInterest;
  reviewingAt: Date | null;
  interviewAt: Date | null;
  offerAt: Date | null;
  hiredAt: Date | null;
  rejectedAt: Date | null;
  rejectionEmailSent: boolean;
};

export type StoredApplicationEvent = {
  id: string;
  applicationId: string;
  companyId: string;
  actorType: ApplicationActorTypeValue;
  actorId: string | null;
  type: ApplicationEventTypeValue;
  fromStage: ApplicationStageValue | null;
  toStage: ApplicationStageValue | null;
  fromDisposition: ApplicationDispositionValue | null;
  toDisposition: ApplicationDispositionValue | null;
  visibility: ApplicationEventVisibilityValue;
  reasonCode: string | null;
  metadata: unknown;
  happenedAt: Date;
  recordedAt: Date;
  idempotencyKey: string | null;
};

type ApplicationUpdate = Partial<
  Pick<
    TransitionApplicationRecord,
    | "stage"
    | "disposition"
    | "stateVersion"
    | "status"
    | "recruiterInterest"
    | "reviewingAt"
    | "interviewAt"
    | "offerAt"
    | "hiredAt"
    | "rejectedAt"
    | "rejectionEmailSent"
  >
>;

export type TransitionTransaction = {
  findApplication(applicationId: string): Promise<TransitionApplicationRecord | null>;
  findEventByIdempotencyKey(
    companyId: string,
    applicationId: string,
    idempotencyKey: string,
  ): Promise<StoredApplicationEvent | null>;
  isActorAuthorized(actor: TransitionActor, companyId: string): Promise<boolean>;
  updateApplicationIfVersion(input: {
    applicationId: string;
    expectedVersion: number;
    changes: ApplicationUpdate;
  }): Promise<boolean>;
  createEvent(
    event: Omit<StoredApplicationEvent, "id" | "recordedAt">,
  ): Promise<StoredApplicationEvent>;
};

export type ApplicationTransitionStore = {
  transaction<T>(work: (tx: TransitionTransaction) => Promise<T>): Promise<T>;
};

export type TransitionApplicationInput = {
  applicationId: string;
  targetStage?: ApplicationStageValue;
  targetDisposition?: ApplicationDispositionValue;
  expectedVersion: number;
  actor: TransitionActor;
  reasonCode?: string;
  reasonText?: string;
  idempotencyKey?: string;
  happenedAt?: Date;
};

type TransitionApplicationResult = {
  state: {
    stage: ApplicationStageValue;
    disposition: ApplicationDispositionValue;
    stateVersion: number;
  };
  event: StoredApplicationEvent;
  replayed: boolean;
  legacyProjectionApplied: boolean;
};

async function authorize(
  tx: TransitionTransaction,
  actor: TransitionActor,
  companyId: string,
) {
  if (!(await tx.isActorAuthorized(actor, companyId))) {
    throw new UnauthorizedApplicationTransitionError();
  }
}

function normalizeOptionalToken(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new Error("Transition token is too long");
  return normalized;
}

function isSerializableWriteConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function timestampChanges(
  application: TransitionApplicationRecord,
  stage: ApplicationStageValue,
  disposition: ApplicationDispositionValue,
  happenedAt: Date,
): ApplicationUpdate {
  const changes: ApplicationUpdate = {};
  if (stage === "REVIEW" && !application.reviewingAt) changes.reviewingAt = happenedAt;
  if (stage === "INTERVIEW" && !application.interviewAt) changes.interviewAt = happenedAt;
  if (stage === "OFFER" && !application.offerAt) changes.offerAt = happenedAt;
  if (disposition === "HIRED" && !application.hiredAt) changes.hiredAt = happenedAt;
  if (disposition === "REJECTED") {
    changes.rejectedAt = happenedAt;
    changes.rejectionEmailSent = false;
  }
  return changes;
}

type ReplayMetadata = {
  commandFingerprint: string;
  resultingStateVersion: number;
  legacyProjectionApplied: boolean;
};

function readReplayMetadata(metadata: unknown): ReplayMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata as Partial<ReplayMetadata>;
  if (
    typeof value.commandFingerprint !== "string" ||
    typeof value.resultingStateVersion !== "number" ||
    typeof value.legacyProjectionApplied !== "boolean"
  ) {
    return null;
  }
  return value as ReplayMetadata;
}

function commandFingerprint(
  input: TransitionApplicationInput,
  reasonCode: string | undefined,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        targetStage: input.targetStage ?? null,
        targetDisposition: input.targetDisposition ?? null,
        expectedVersion: input.expectedVersion,
        actorType: input.actor.type,
        actorId: input.actor.id ?? null,
        actorCompanyId: input.actor.companyId ?? null,
        reasonCode: reasonCode ?? null,
      }),
    )
    .digest("hex");
}

function replayResult(
  event: StoredApplicationEvent,
  fingerprint: string,
): TransitionApplicationResult {
  const metadata = readReplayMetadata(event.metadata);
  if (!metadata || metadata.commandFingerprint !== fingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  const stage = event.toStage;
  const disposition = event.toDisposition;
  if (!stage || !disposition) throw new CanonicalStateUnavailableError();
  return {
    state: {
      stage,
      disposition,
      stateVersion: metadata.resultingStateVersion,
    },
    event,
    replayed: true,
    legacyProjectionApplied: metadata.legacyProjectionApplied,
  };
}

async function executeTransition(
  tx: TransitionTransaction,
  input: TransitionApplicationInput,
  idempotencyKey: string | undefined,
  reasonCode: string | undefined,
  happenedAt: Date,
  fingerprint: string,
): Promise<TransitionApplicationResult> {
  const application = await tx.findApplication(input.applicationId);
  if (!application) throw new ApplicationNotFoundError();
  await authorize(tx, input.actor, application.companyId);

  if (idempotencyKey) {
    const priorEvent = await tx.findEventByIdempotencyKey(
      application.companyId,
      application.id,
      idempotencyKey,
    );
    if (priorEvent) return replayResult(priorEvent, fingerprint);
  }

  if (!application.stage || !application.disposition) {
    throw new CanonicalStateUnavailableError();
  }
  if (application.stateVersion !== input.expectedVersion) {
    throw new ConcurrentApplicationTransitionError();
  }

  const planned = planApplicationTransition(
    { stage: application.stage, disposition: application.disposition },
    {
      targetStage: input.targetStage,
      targetDisposition: input.targetDisposition,
      reasonCode,
      reasonText: input.reasonText,
    },
  );
  const legacyProjection = projectCanonicalStateToLegacy(planned);
  const changes: ApplicationUpdate = {
    stage: planned.stage,
    disposition: planned.disposition,
    stateVersion: application.stateVersion + 1,
    ...timestampChanges(
      application,
      planned.stage,
      planned.disposition,
      happenedAt,
    ),
    ...(legacyProjection ?? {}),
  };

  const updated = await tx.updateApplicationIfVersion({
    applicationId: application.id,
    expectedVersion: application.stateVersion,
    changes,
  });
  if (!updated) throw new ConcurrentApplicationTransitionError();

  const type = eventTypeForTransition(
    application.stage,
    planned.stage,
    planned.disposition,
  );
  const event = await tx.createEvent({
    applicationId: application.id,
    companyId: application.companyId,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    type,
    fromStage: application.stage,
    toStage: planned.stage,
    fromDisposition: application.disposition,
    toDisposition: planned.disposition,
    visibility: applicationEventVisibility(type),
    reasonCode: reasonCode ?? null,
    metadata: {
      schemaVersion: 1,
      transitionClass: planned.transitionClass,
      legacyProjection: legacyProjection ? "SAFE_AUTO_MAP" : "NOT_APPLIED",
      legacyProjectionApplied: Boolean(legacyProjection),
      resultingStateVersion: application.stateVersion + 1,
      commandFingerprint: fingerprint,
      reasonTextProvided: Boolean(input.reasonText?.trim()),
    },
    happenedAt,
    idempotencyKey: idempotencyKey ?? null,
  });

  return {
    state: {
      stage: planned.stage,
      disposition: planned.disposition,
      stateVersion: application.stateVersion + 1,
    },
    event,
    replayed: false,
    legacyProjectionApplied: Boolean(legacyProjection),
  };
}

export async function transitionApplication(
  input: TransitionApplicationInput,
  options: {
    store?: ApplicationTransitionStore;
  } = {},
): Promise<TransitionApplicationResult> {
  if (!isCanonicalHiringProcessEnabled()) {
    throw new CanonicalHiringProcessDisabledError();
  }

  const idempotencyKey = normalizeOptionalToken(input.idempotencyKey, 200);
  const reasonCode = normalizeOptionalToken(input.reasonCode, 80);
  const happenedAt = input.happenedAt ?? new Date();
  const fingerprint = commandFingerprint(input, reasonCode);
  const store = options.store ?? (await import("./prisma-transition-store")).prismaApplicationTransitionStore;

  try {
    return await store.transaction((tx) =>
      executeTransition(
        tx,
        input,
        idempotencyKey,
        reasonCode,
        happenedAt,
        fingerprint,
      ),
    );
  } catch (error) {
    const writeConflict = isSerializableWriteConflict(error);
    if (!idempotencyKey) {
      if (writeConflict) throw new ConcurrentApplicationTransitionError();
      throw error;
    }
    let replay: TransitionApplicationResult | null;
    try {
      replay = await store.transaction(async (tx) => {
        const application = await tx.findApplication(input.applicationId);
        if (!application) return null;
        await authorize(tx, input.actor, application.companyId);
        const event = await tx.findEventByIdempotencyKey(
          application.companyId,
          application.id,
          idempotencyKey,
        );
        return event ? replayResult(event, fingerprint) : null;
      });
    } catch (replayError) {
      if (writeConflict || isSerializableWriteConflict(replayError)) {
        throw new ConcurrentApplicationTransitionError();
      }
      throw error;
    }
    if (replay) return replay;
    if (writeConflict) throw new ConcurrentApplicationTransitionError();
    throw error;
  }
}
