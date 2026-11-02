import { createHash } from "node:crypto";

import { applicationEventVisibility, eventTypeForTransition } from "./event-policy";

import {
  projectCanonicalStateToLegacy,
  classifyLegacyApplicationState,
  type LegacyApplicationInterest,
  type LegacyApplicationStatus,
} from "./legacy-mapping";
import { InvalidApplicationTransitionError, planApplicationTransition, planRecruiterStateChange } from "./rules";
import { getRecruitingPresentation } from "./recruiting-presentation";
import type { RecruitingState } from "./recruiter-state";
import type {
  ApplicationActorTypeValue,
  ApplicationDispositionValue,
  ApplicationEventTypeValue,
  ApplicationEventVisibilityValue,
  ApplicationStageValue,
} from "./types";


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
  jobId?: string;
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
> & {
  rejectionEmailLeaseUntil?: Date | null;
  rejectionEmailLeaseToken?: string | null;
  rejectionEmailAttemptStartedAt?: Date | null;
};

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
  legacyProjectionOverride?: {
    status: LegacyApplicationStatus;
    recruiterInterest: LegacyApplicationInterest;
  };
  allowReopen?: boolean;
  /** Server-selected mode used exclusively by SET_RECRUITING_STATE. */
  recruitingDestination?: RecruitingState;
};

type TransitionApplicationResult = {
  jobId?: string;
  state: {
    stage: ApplicationStageValue;
    disposition: ApplicationDispositionValue;
    stateVersion: number;
  };
  event: StoredApplicationEvent;
  replayed: boolean;
  legacyProjectionApplied: boolean;
  timestamps: {
    offerAt: Date | null;
    hiredAt: Date | null;
    rejectedAt?: Date | null;
  };
  legacy?: { status: LegacyApplicationStatus; recruiterInterest: LegacyApplicationInterest; stateVersion: number };
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
        reasonText: input.reasonText ?? null,
        legacyProjectionOverride: input.legacyProjectionOverride ?? null,
        allowReopen: input.allowReopen ?? false,
        ...(input.recruitingDestination ? { recruitingDestination: input.recruitingDestination } : {}),
      }),
    )
    .digest("hex");
}

function replayResult(
  event: StoredApplicationEvent,
  fingerprint: string,
  application: TransitionApplicationRecord,
): TransitionApplicationResult {
  const metadata = readReplayMetadata(event.metadata);
  if (!metadata || metadata.commandFingerprint !== fingerprint) {
    throw new IdempotencyKeyConflictError();
  }
  const stage = event.toStage;
  const disposition = event.toDisposition;
  if (!stage || !disposition) throw new CanonicalStateUnavailableError();
  return {
    jobId: application.jobId,
    state: {
      stage,
      disposition,
      stateVersion: metadata.resultingStateVersion,
    },
    event,
    replayed: true,
    legacyProjectionApplied: metadata.legacyProjectionApplied,
    ...(typeof event.metadata === "object" && event.metadata !== null && "resultingLegacy" in event.metadata
      ? { legacy: event.metadata.resultingLegacy as TransitionApplicationResult["legacy"] } : {}),
    timestamps: {
      offerAt: application.offerAt,
      hiredAt: application.hiredAt,
    },
  };
}

async function executeTransition(
  tx: TransitionTransaction,
  input: TransitionApplicationInput,
  idempotencyKey: string | undefined,
  reasonCode: string | undefined,
  happenedAt: Date,
  fingerprint: string,
  assertSource?: (application: TransitionApplicationRecord) => void,
): Promise<TransitionApplicationResult> {
  const application = await tx.findApplication(input.applicationId);
  if (!application) throw new ApplicationNotFoundError();
  await authorize(tx, input.actor, application.companyId);
  if (input.recruitingDestination && (input.actor.type !== "RECRUITER" && input.actor.type !== "ADMIN")) {
    throw new UnauthorizedApplicationTransitionError();
  }

  if (idempotencyKey) {
    const priorEvent = await tx.findEventByIdempotencyKey(
      application.companyId,
      application.id,
      idempotencyKey,
    );
    if (priorEvent) return replayResult(priorEvent, fingerprint, application);
  }

  if ((!application.stage || !application.disposition) && !input.recruitingDestination) {
    throw new CanonicalStateUnavailableError();
  }
  if (application.stateVersion !== input.expectedVersion) {
    throw new ConcurrentApplicationTransitionError();
  }

  // Runs on the same serializable snapshot as the write, after command replay.
  assertSource?.(application);

  let sourceStage = application.stage;
  let sourceDisposition = application.disposition;
  if (input.recruitingDestination) {
    if (getRecruitingPresentation(application, true).section === "RECONCILIATION") throw new CanonicalStateUnavailableError();
    if (!sourceStage || !sourceDisposition) {
      if (sourceStage !== null || sourceDisposition !== null || application.stateVersion !== 0) throw new CanonicalStateUnavailableError();
      const mapping = classifyLegacyApplicationState(application.status, application.recruiterInterest);
      if (!mapping.autoApplicable || !mapping.suggestedStage || !mapping.suggestedDisposition) throw new CanonicalStateUnavailableError();
      sourceStage = mapping.suggestedStage;
      sourceDisposition = mapping.suggestedDisposition;
    }
    const projection = projectCanonicalStateToLegacy({ stage: sourceStage, disposition: sourceDisposition === "HOLD" ? "ACTIVE" : sourceDisposition });
    // Preselection is a separate valid REVIEW projection. Other contradictions require reconciliation.
    if (projection && (projection.status !== application.status ||
        (projection.recruiterInterest !== application.recruiterInterest && !(sourceStage === "REVIEW" && application.recruiterInterest === "MAYBE")))) {
      throw new CanonicalStateUnavailableError();
    }
    if ((sourceDisposition === "ACTIVE" || sourceDisposition === "HOLD") && (application.hiredAt || application.rejectedAt || application.rejectionEmailSent || application.status === "HIRED" || application.status === "REJECTED" || application.recruiterInterest === "REJECTED")) {
      throw new InvalidApplicationTransitionError("La fuente activa contiene footprints terminales");
    }
  }
  if (!sourceStage || !sourceDisposition) throw new CanonicalStateUnavailableError();
  const planned = input.recruitingDestination
    ? planRecruiterStateChange({ stage: sourceStage, disposition: sourceDisposition }, input.recruitingDestination, reasonCode)
    : planApplicationTransition(
    { stage: sourceStage, disposition: sourceDisposition },
    {
      targetStage: input.targetStage,
      targetDisposition: input.targetDisposition,
      reasonCode,
      reasonText: input.reasonText,
      allowReopen: input.allowReopen,
    },
  );
  const legacyProjection =
    input.legacyProjectionOverride ?? projectCanonicalStateToLegacy(planned);
  if (input.recruitingDestination && legacyProjection && sourceStage === "REVIEW" && planned.stage === "REVIEW" && application.recruiterInterest === "MAYBE") {
    legacyProjection.recruiterInterest = "MAYBE";
  }
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
    ...(planned.transitionClass === "REOPEN"
      ? { rejectedAt: null, rejectionEmailSent: false }
      : {}),
  };
  if (input.recruitingDestination) {
    // HOLD keeps its real stage and projection; WITHDRAWN/CANCELLED have no legacy enum.
    // Retain that historical projection rather than fabricating REJECTED/HIRED.
    if (planned.disposition !== "HIRED") changes.hiredAt = null;
    if (planned.disposition !== "REJECTED") { changes.rejectedAt = null; changes.rejectionEmailSent = false; }
    if (planned.stage === "APPLIED") { changes.offerAt = null; changes.interviewAt = null; }
    if (planned.disposition === "HOLD" && sourceStage === "CLOSED") {
      Object.assign(changes, projectCanonicalStateToLegacy({ stage: "REVIEW", disposition: "ACTIVE" }));
    }
  }

  // Reiniciar el control de notificación cuando cambia
  // el periodo de rechazo.
  if (
    planned.disposition !== "REJECTED" ||
    application.disposition !== "REJECTED"
  ) {
    changes.rejectionEmailLeaseUntil = null;
    changes.rejectionEmailLeaseToken = null;
    changes.rejectionEmailAttemptStartedAt = null;
  }

  const updated = await tx.updateApplicationIfVersion({
    applicationId: application.id,
    expectedVersion: application.stateVersion,
    changes,
  });
  if (!updated) throw new ConcurrentApplicationTransitionError();

  const type = eventTypeForTransition(
    sourceStage,
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
      ...(input.recruitingDestination ? {
        operation: "SET_RECRUITING_STATE", destination: input.recruitingDestination,
        legacyImported: application.stage === null,
        previousState: {
          stage: application.stage, disposition: application.disposition, status: application.status,
          recruiterInterest: application.recruiterInterest, stateVersion: application.stateVersion,
          reviewingAt: application.reviewingAt?.toISOString() ?? null, interviewAt: application.interviewAt?.toISOString() ?? null,
          offerAt: application.offerAt?.toISOString() ?? null, hiredAt: application.hiredAt?.toISOString() ?? null,
          rejectedAt: application.rejectedAt?.toISOString() ?? null, rejectionEmailSent: application.rejectionEmailSent,
        },
        resultingLegacy: { status: changes.status ?? application.status, recruiterInterest: changes.recruiterInterest ?? application.recruiterInterest, stateVersion: application.stateVersion + 1 },
        reasonText: input.reasonText ?? null,
      } : {}),
    },
    happenedAt,
    idempotencyKey: idempotencyKey ?? null,
  });

  return {
    jobId: application.jobId,
    state: {
      stage: planned.stage,
      disposition: planned.disposition,
      stateVersion: application.stateVersion + 1,
    },
    event,
    replayed: false,
    legacyProjectionApplied: Boolean(legacyProjection),
    timestamps: {
      offerAt: changes.offerAt !== undefined ? changes.offerAt : application.offerAt,
      hiredAt: changes.hiredAt !== undefined ? changes.hiredAt : application.hiredAt,
      rejectedAt: changes.rejectedAt !== undefined ? changes.rejectedAt : application.rejectedAt,
    },
    legacy: { status: changes.status ?? application.status, recruiterInterest: changes.recruiterInterest ?? application.recruiterInterest, stateVersion: application.stateVersion + 1 },
  };
}

export async function transitionApplication(
  input: TransitionApplicationInput,
  options: {
    store?: ApplicationTransitionStore;
    assertSource?: (application: TransitionApplicationRecord) => void;
  } = {},
): Promise<TransitionApplicationResult> {

  const idempotencyKey = normalizeOptionalToken(input.idempotencyKey, 200);
  const reasonCode = normalizeOptionalToken(input.reasonCode, 80);
  const reasonText = normalizeOptionalToken(input.reasonText, 500);
  const normalizedInput = { ...input, reasonText };
  const happenedAt = input.happenedAt ?? new Date();
  const fingerprint = commandFingerprint(normalizedInput, reasonCode);
  const store = options.store ?? (await import("./prisma-transition-store")).prismaApplicationTransitionStore;

  try {
    return await store.transaction((tx) =>
      executeTransition(
        tx,
        normalizedInput,
        idempotencyKey,
        reasonCode,
        happenedAt,
        fingerprint,
        options.assertSource,
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
        const application = await tx.findApplication(normalizedInput.applicationId);
        if (!application) return null;
        await authorize(tx, normalizedInput.actor, application.companyId);
        const event = await tx.findEventByIdempotencyKey(
          application.companyId,
          application.id,
          idempotencyKey,
        );
        return event ? replayResult(event, fingerprint, application) : null;
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
