import type {
  ApplicationDispositionValue,
  ApplicationStageValue,
} from "@/lib/hiring-process/types";

export const CANDIDATE_PROCESS_BUCKETS = [
  "RECEIVED",
  "REVIEWING",
  "ASSESSMENT",
  "INTERVIEW",
  "DECISION",
  "CLOSED",
] as const;

export type CandidateProcessBucket =
  (typeof CANDIDATE_PROCESS_BUCKETS)[number];

export type CandidateReadModelSource = "CANONICAL" | "LEGACY_FALLBACK";

export type CandidateApplicationReadInput = {
  stage: ApplicationStageValue | null;
  disposition: ApplicationDispositionValue | null;
  status: string;
};

export type CandidateApplicationReadModel = {
  bucket: CandidateProcessBucket;
  label: string;
  source: CandidateReadModelSource;
};

export type CandidateApplicationReadRow<T> = T & {
  _candidateRead: CandidateApplicationReadModel;
};

export const CANDIDATE_PROCESS_LABELS: Record<
  CandidateProcessBucket,
  string
> = {
  RECEIVED: "Postulación recibida",
  REVIEWING: "Revisando perfil",
  ASSESSMENT: "Evaluación",
  INTERVIEW: "Entrevista",
  DECISION: "Decisión",
  CLOSED: "Proceso cerrado",
};

const LEGACY_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Enviada",
  REVIEWING: "En revisión",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  HIRED: "Contratado",
  REJECTED: "Rechazada",
};

function legacyBucket(status: string): CandidateProcessBucket {
  switch (status.toUpperCase()) {
    case "REVIEWING":
      return "REVIEWING";
    case "INTERVIEW":
      return "INTERVIEW";
    case "OFFER":
      return "DECISION";
    case "HIRED":
    case "REJECTED":
      return "CLOSED";
    default:
      return "RECEIVED";
  }
}

function legacyLabel(status: string) {
  return LEGACY_STATUS_LABELS[status.toUpperCase()] ?? "Enviada";
}

function canonicalBucket(
  stage: ApplicationStageValue,
  disposition: ApplicationDispositionValue,
): CandidateProcessBucket {
  if (
    disposition === "REJECTED" ||
    disposition === "WITHDRAWN" ||
    disposition === "HIRED" ||
    disposition === "CANCELLED" ||
    stage === "CLOSED"
  ) {
    return "CLOSED";
  }

  switch (stage) {
    case "APPLIED":
      return "RECEIVED";
    case "REVIEW":
      return "REVIEWING";
    case "ASSESSMENT":
      return "ASSESSMENT";
    case "INTERVIEW":
      return "INTERVIEW";
    case "OFFER":
      return "DECISION";
  }
}

export function getCandidateApplicationReadModel(
  input: CandidateApplicationReadInput,
  options: { canonicalReadsEnabled: boolean },
): CandidateApplicationReadModel {
  const hasCompleteCanonicalState =
    input.stage !== null && input.disposition !== null;

  const source: CandidateReadModelSource =
    options.canonicalReadsEnabled && hasCompleteCanonicalState
      ? "CANONICAL"
      : "LEGACY_FALLBACK";

  if (source === "LEGACY_FALLBACK") {
    return {
      bucket: legacyBucket(input.status),
      label: legacyLabel(input.status),
      source,
    };
  }

  const bucket = canonicalBucket(input.stage!, input.disposition!);

  return {
    bucket,
    label: CANDIDATE_PROCESS_LABELS[bucket],
    source,
  };
}

export function buildCandidateApplicationReadRows<
  T extends CandidateApplicationReadInput,
>(
  applications: readonly T[],
  options: { canonicalReadsEnabled: boolean },
): Array<CandidateApplicationReadRow<T>> {
  return applications.map((application) => ({
    ...application,
    _candidateRead: getCandidateApplicationReadModel(application, options),
  }));
}

export type CandidateProcessCounts = Record<CandidateProcessBucket, number>;

export type CandidateProcessFilter = {
  bucket: CandidateProcessBucket;
  legacyTerminalStatus?: "HIRED" | "REJECTED";
};

export function countCandidateProcessBuckets(
  rows: ReadonlyArray<{ _candidateRead: CandidateApplicationReadModel }>,
): CandidateProcessCounts {
  const counts = Object.fromEntries(
    CANDIDATE_PROCESS_BUCKETS.map((bucket) => [bucket, 0]),
  ) as CandidateProcessCounts;

  for (const row of rows) {
    counts[row._candidateRead.bucket]++;
  }

  return counts;
}

export function filterCandidateProcessRows<
  T extends CandidateApplicationReadInput & {
    _candidateRead: CandidateApplicationReadModel;
  },
>(
  rows: readonly T[],
  filter: CandidateProcessFilter | undefined,
): T[] {
  if (!filter) return [...rows];

  return rows.filter((row) => {
    if (row._candidateRead.bucket !== filter.bucket) return false;

    if (!filter.legacyTerminalStatus) return true;

    return row._candidateRead.source === "CANONICAL"
      ? row.disposition === filter.legacyTerminalStatus
      : row.status.toUpperCase() === filter.legacyTerminalStatus;
  });
}

const LEGACY_STATUS_TO_PROCESS: Record<string, CandidateProcessBucket> = {
  SUBMITTED: "RECEIVED",
  REVIEWING: "REVIEWING",
  INTERVIEW: "INTERVIEW",
  OFFER: "DECISION",
};

export function resolveCandidateProcessFilter({
  process,
  status,
}: {
  process?: string;
  status?: string;
}): CandidateProcessFilter | undefined {
  const requestedProcess = process?.toUpperCase();

  if (
    requestedProcess &&
    CANDIDATE_PROCESS_BUCKETS.includes(
      requestedProcess as CandidateProcessBucket,
    )
  ) {
    return {
      bucket: requestedProcess as CandidateProcessBucket,
    };
  }

  const legacyStatus = status?.toUpperCase();

  if (legacyStatus === "HIRED" || legacyStatus === "REJECTED") {
    return {
      bucket: "CLOSED",
      legacyTerminalStatus: legacyStatus,
    };
  }

  const legacyBucket = legacyStatus
    ? LEGACY_STATUS_TO_PROCESS[legacyStatus]
    : undefined;

  return legacyBucket ? { bucket: legacyBucket } : undefined;
}
