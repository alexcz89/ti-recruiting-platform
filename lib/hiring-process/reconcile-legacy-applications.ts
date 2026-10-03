import { Prisma, PrismaClient } from "@prisma/client";

import {
  classifyLegacyApplicationState,
  projectCanonicalStateToLegacy,
  type LegacyApplicationInterest,
  type LegacyApplicationStateMapping,
  type LegacyApplicationStatus,
} from "./legacy-mapping";
import type {
  ApplicationDispositionValue,
  ApplicationStageValue,
} from "./types";

export const LEGACY_STATE_MAPPING_VERSION =
  "legacy-application-state-matrix:v1";
const BASELINE_IDEMPOTENCY_KEY =
  `legacy-state-import:${LEGACY_STATE_MAPPING_VERSION}`;

type ReconciliationMode = "dry-run" | "apply";
type ReconciliationOutcome =
  | "would-import"
  | "imported"
  | "skipped"
  | "requires-review"
  | "conflict"
  | "failure";

export type ReconcileLegacyApplicationsOptions = {
  mode?: ReconciliationMode;
  applicationId?: string;
  companyId?: string;
  global?: boolean;
  batchSize?: number;
  afterId?: string;
};

export type ReconciliationItem = {
  applicationId: string;
  companyId: string;
  outcome: ReconciliationOutcome;
  classification?: LegacyApplicationStateMapping["classification"];
  reason?: string;
};

export type ReconciliationResult = {
  mode: ReconciliationMode;
  scope: "application" | "company" | "global";
  batchSize: number;
  processed: number;
  wouldImport: number;
  imported: number;
  skipped: number;
  requiresReview: number;
  conflicts: number;
  failures: number;
  nextAfterId: string | null;
  items: ReconciliationItem[];
};

type BaselineEvent = {
  companyId: string;
  type: string;
  actorType: string;
  actorId: string | null;
  fromStage: string | null;
  toStage: string | null;
  fromDisposition: string | null;
  toDisposition: string | null;
  visibility: string;
  metadata: unknown;
  idempotencyKey: string | null;
};

type ReconciliationApplication = {
  id: string;
  companyId: string;
  status: LegacyApplicationStatus;
  recruiterInterest: LegacyApplicationInterest;
  stage: string | null;
  disposition: string | null;
  stateVersion: number;
  events: BaselineEvent[];
};

type Evaluation = {
  outcome: Exclude<ReconciliationOutcome, "imported" | "failure">;
  mapping?: LegacyApplicationStateMapping;
  reason?: string;
};

class ReconciliationConcurrencyError extends Error {}

function validateOptions(options: ReconcileLegacyApplicationsOptions) {
  const mode = options.mode ?? "dry-run";
  const selectedScopes = [
    Boolean(options.applicationId),
    Boolean(options.companyId),
    Boolean(options.global),
  ].filter(Boolean).length;
  if (selectedScopes > 1) {
    throw new Error("Choose exactly one reconciliation scope");
  }
  if (mode === "apply" && selectedScopes === 0) {
    throw new Error(
      "Apply mode requires --application-id, --company-id, or explicit --global",
    );
  }

  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("batchSize must be an integer between 1 and 500");
  }

  return {
    mode,
    batchSize,
    scope: options.applicationId
      ? ("application" as const)
      : options.companyId
        ? ("company" as const)
        : ("global" as const),
  };
}

function expectedMetadata(application: ReconciliationApplication, mapping: LegacyApplicationStateMapping) {
  return {
    schemaVersion: 1,
    mappingVersion: LEGACY_STATE_MAPPING_VERSION,
    legacy: {
      status: application.status,
      recruiterInterest: application.recruiterInterest,
    },
    classification: mapping.classification,
    imported: {
      stage: mapping.suggestedStage,
      disposition: mapping.suggestedDisposition,
    },
  };
}

function mappingFromBaselineEvent(
  event: BaselineEvent,
  expectedCompanyId: string,
) {
  if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
    return null;
  }
  const metadata = event.metadata as Record<string, unknown>;
  const legacy = metadata.legacy;
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return null;
  const { status, recruiterInterest } = legacy as Record<string, unknown>;
  if (typeof status !== "string" || typeof recruiterInterest !== "string") {
    return null;
  }

  let mapping: LegacyApplicationStateMapping;
  try {
    mapping = classifyLegacyApplicationState(
      status as LegacyApplicationStatus,
      recruiterInterest as LegacyApplicationInterest,
    );
  } catch {
    return null;
  }
  if (!mapping.autoApplicable) return null;
  const historicalSnapshot = {
    status: mapping.status,
    recruiterInterest: mapping.recruiterInterest,
  } as ReconciliationApplication;
  const eventMatches =
    event.companyId === expectedCompanyId &&
    event.actorType === "IMPORT" &&
    event.actorId === null &&
    event.fromStage === null &&
    event.toStage === mapping.suggestedStage &&
    event.fromDisposition === null &&
    event.toDisposition === mapping.suggestedDisposition &&
    event.visibility === "INTERNAL" &&
    event.idempotencyKey === BASELINE_IDEMPOTENCY_KEY &&
    metadataMatches(event.metadata, expectedMetadata(historicalSnapshot, mapping));
  return eventMatches ? mapping : null;
}

function hasValidEventChain(application: ReconciliationApplication) {
  if (application.events.length !== application.stateVersion) return false;
  let stage: string | null = null;
  let disposition: string | null = null;
  for (const event of application.events) {
    if (
      event.companyId !== application.companyId ||
      event.fromStage !== stage ||
      event.fromDisposition !== disposition ||
      event.toStage === null ||
      event.toDisposition === null
    ) {
      return false;
    }
    stage = event.toStage;
    disposition = event.toDisposition;
  }
  return stage === application.stage && disposition === application.disposition;
}

function metadataMatches(actual: unknown, expected: ReturnType<typeof expectedMetadata>) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)]),
      );
    }
    return value;
  };
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
}

function evaluateApplication(
  application: ReconciliationApplication,
): Evaluation {
  let mapping: LegacyApplicationStateMapping;
  try {
    mapping = classifyLegacyApplicationState(
      application.status,
      application.recruiterInterest,
    );
  } catch (error) {
    return {
      outcome: "conflict",
      reason: error instanceof Error ? error.message : "Unknown legacy state",
    };
  }

  const hasStage = application.stage !== null;
  const hasDisposition = application.disposition !== null;
  if (hasStage !== hasDisposition) {
    return { outcome: "conflict", mapping, reason: "Partial canonical state" };
  }

  if (!hasStage) {
    if (application.events.some((event) => event.type === "LEGACY_STATE_IMPORTED")) {
      return {
        outcome: "conflict",
        mapping,
        reason: "Baseline event exists without canonical snapshot",
      };
    }
    if (application.stateVersion !== 0) {
      return {
        outcome: "conflict",
        mapping,
        reason: "Initial canonical state has a stale stateVersion",
      };
    }
    if (!mapping.autoApplicable) {
      return { outcome: "requires-review", mapping, reason: mapping.reason };
    }
    return { outcome: "would-import", mapping };
  }

  const baselineEvents = application.events.filter(
    (event) => event.type === "LEGACY_STATE_IMPORTED",
  );
  if (baselineEvents.length !== 1) {
    return {
      outcome: "conflict",
      mapping,
      reason:
        baselineEvents.length === 0
          ? "Canonical snapshot exists without baseline event"
          : "Multiple baseline events exist",
    };
  }

  const baselineMapping = mappingFromBaselineEvent(
    baselineEvents[0],
    application.companyId,
  );
  const currentProjection = projectCanonicalStateToLegacy({
    stage: application.stage as ApplicationStageValue,
    disposition: application.disposition as ApplicationDispositionValue,
  });
  const legacyMatchesProjection =
    currentProjection === null ||
    (application.status === currentProjection.status &&
      application.recruiterInterest === currentProjection.recruiterInterest);
  if (
    !baselineMapping ||
    application.events[0]?.type !== "LEGACY_STATE_IMPORTED" ||
    !hasValidEventChain(application) ||
    !legacyMatchesProjection
  ) {
    return {
      outcome: "conflict",
      mapping,
      reason: "Canonical snapshot or baseline event contradicts safe mapping",
    };
  }
  return { outcome: "skipped", mapping: baselineMapping, reason: "Already reconciled" };
}

function toApplication(row: {
  id: string;
  status: LegacyApplicationStatus;
  recruiterInterest: LegacyApplicationInterest;
  stage: string | null;
  disposition: string | null;
  stateVersion: number;
  job: { companyId: string };
  events: BaselineEvent[];
}): ReconciliationApplication {
  return { ...row, companyId: row.job.companyId };
}

const applicationSelect = {
  id: true,
  status: true,
  recruiterInterest: true,
  stage: true,
  disposition: true,
  stateVersion: true,
  job: { select: { companyId: true } },
  events: {
    orderBy: [
      { recordedAt: "asc" as const },
      { id: "asc" as const },
    ],
  },
} satisfies Prisma.ApplicationSelect;

async function loadApplicationForReconciliation(
  client: Prisma.TransactionClient | PrismaClient,
  applicationId: string,
) {
  const row = await client.application.findUnique({
    where: { id: applicationId },
    select: applicationSelect,
  });
  return row ? toApplication(row) : null;
}

async function applyOne(
  client: PrismaClient,
  applicationId: string,
): Promise<ReconciliationItem> {
  try {
    return await client.$transaction(
      async (tx) => {
        const application = await loadApplicationForReconciliation(
          tx,
          applicationId,
        );
        if (!application) {
          return {
            applicationId,
            companyId: "unknown",
            outcome: "conflict",
            reason: "Application disappeared before reconciliation",
          };
        }

        const evaluation = evaluateApplication(application);
        if (evaluation.outcome !== "would-import" || !evaluation.mapping) {
          return {
            applicationId,
            companyId: application.companyId,
            outcome: evaluation.outcome,
            classification: evaluation.mapping?.classification,
            reason: evaluation.reason,
          };
        }

        const mapping = evaluation.mapping;
        const updated = await tx.application.updateMany({
          where: {
            id: application.id,
            status: application.status,
            recruiterInterest: application.recruiterInterest,
            stage: null,
            disposition: null,
            stateVersion: 0,
          },
          data: {
            stage: mapping.suggestedStage!,
            disposition: mapping.suggestedDisposition!,
            stateVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new ReconciliationConcurrencyError();

        const happenedAt = new Date();
        await tx.applicationEvent.create({
          data: {
            applicationId: application.id,
            companyId: application.companyId,
            actorType: "IMPORT",
            actorId: null,
            type: "LEGACY_STATE_IMPORTED",
            fromStage: null,
            toStage: mapping.suggestedStage!,
            fromDisposition: null,
            toDisposition: mapping.suggestedDisposition!,
            visibility: "INTERNAL",
            reasonCode: null,
            metadata: expectedMetadata(application, mapping),
            happenedAt,
            idempotencyKey: BASELINE_IDEMPOTENCY_KEY,
          },
        });

        return {
          applicationId,
          companyId: application.companyId,
          outcome: "imported",
          classification: mapping.classification,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof ReconciliationConcurrencyError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code))
    ) {
      const current = await loadApplicationForReconciliation(
        client,
        applicationId,
      );
      if (current) {
        const evaluation = evaluateApplication(current);
        return {
          applicationId,
          companyId: current.companyId,
          outcome: evaluation.outcome === "skipped" ? "skipped" : "conflict",
          classification: evaluation.mapping?.classification,
          reason:
            evaluation.outcome === "skipped"
              ? "Concurrent import already completed"
              : "Application changed concurrently",
        };
      }
      return {
        applicationId,
        companyId: "unknown",
        outcome: "conflict",
        reason: "Application changed concurrently",
      };
    }
    return {
      applicationId,
      companyId: "unknown",
      outcome: "failure",
      reason: error instanceof Error ? error.message : "Reconciliation failed",
    };
  }
}

function summarize(
  mode: ReconciliationMode,
  scope: ReconciliationResult["scope"],
  batchSize: number,
  items: ReconciliationItem[],
  nextAfterId: string | null,
): ReconciliationResult {
  const count = (outcome: ReconciliationOutcome) =>
    items.filter((item) => item.outcome === outcome).length;
  return {
    mode,
    scope,
    batchSize,
    processed: items.length,
    wouldImport: count("would-import"),
    imported: count("imported"),
    skipped: count("skipped"),
    requiresReview: count("requires-review"),
    conflicts: count("conflict"),
    failures: count("failure"),
    nextAfterId,
    items,
  };
}

async function reconcileLegacyApplicationsWithClient(
  client: PrismaClient,
  options: ReconcileLegacyApplicationsOptions = {},
): Promise<ReconciliationResult> {
  const { mode, batchSize, scope } = validateOptions(options);
  const rows = await client.application.findMany({
    where: {
      ...(options.applicationId ? { id: options.applicationId } : {}),
      ...(options.companyId ? { job: { companyId: options.companyId } } : {}),
      ...(!options.applicationId && options.afterId
        ? { id: { gt: options.afterId } }
        : {}),
    },
    orderBy: { id: "asc" },
    take: options.applicationId ? 1 : batchSize,
    select: applicationSelect,
  });
  const applications = rows.map(toApplication);
  const nextAfterId =
    !options.applicationId && rows.length === batchSize
      ? rows[rows.length - 1]?.id ?? null
      : null;

  if (mode === "dry-run") {
    const items = applications.map((application): ReconciliationItem => {
      const evaluation = evaluateApplication(application);
      return {
        applicationId: application.id,
        companyId: application.companyId,
        outcome: evaluation.outcome,
        classification: evaluation.mapping?.classification,
        reason: evaluation.reason,
      };
    });
    return summarize(mode, scope, batchSize, items, nextAfterId);
  }

  const items: ReconciliationItem[] = [];
  for (const application of applications) {
    items.push(await applyOne(client, application.id));
  }
  return summarize(mode, scope, batchSize, items, nextAfterId);
}

export function createLegacyApplicationReconciler(client: PrismaClient) {
  return (options: ReconcileLegacyApplicationsOptions = {}) =>
    reconcileLegacyApplicationsWithClient(client, options);
}
