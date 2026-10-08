import type {
  ApplicationDispositionValue,
  ApplicationStageValue,
} from "@/lib/hiring-process/types";

export const RECRUITER_PIPELINE_BUCKETS = [
  "APPLIED",
  "REVIEW",
  "PRESELECTED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "HIRED",
  "HOLD",
  "CLOSED_OTHER",
] as const;

export type RecruiterPipelineBucket =
  (typeof RECRUITER_PIPELINE_BUCKETS)[number];

export type RecruiterReadModelSource = "CANONICAL" | "LEGACY_FALLBACK";

export type RecruiterApplicationReadInput = {
  stage: ApplicationStageValue | null;
  disposition: ApplicationDispositionValue | null;
  status: string;
  recruiterInterest: string;
};

export type RecruiterApplicationReadModel = {
  bucket: RecruiterPipelineBucket;
  label: string;
  source: RecruiterReadModelSource;
};

export type RecruiterApplicationReadRow<T> = T & {
  _recruiterRead: RecruiterApplicationReadModel;
};

export const RECRUITER_PIPELINE_LABELS: Record<
  RecruiterPipelineBucket,
  string
> = {
  APPLIED: "Por revisar",
  REVIEW: "En revisión",
  PRESELECTED: "Preselecto",
  ASSESSMENT: "Evaluación",
  INTERVIEW: "Entrevista",
  OFFER: "Oferta",
  REJECTED: "Descartado",
  HIRED: "Contratado",
  HOLD: "En pausa",
  CLOSED_OTHER: "Cerrado",
};

export const PRIMARY_RECRUITER_PIPELINE_BUCKETS = [
  "APPLIED",
  "REVIEW",
  "PRESELECTED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "HIRED",
] as const satisfies readonly RecruiterPipelineBucket[];

function legacyBucket(recruiterInterest: string): RecruiterPipelineBucket {
  switch (recruiterInterest.toUpperCase()) {
    case "MAYBE":
      return "PRESELECTED";
    case "ACCEPTED":
      return "INTERVIEW";
    case "REJECTED":
      return "REJECTED";
    default:
      return "APPLIED";
  }
}

function canonicalBucket(
  input: RecruiterApplicationReadInput,
): RecruiterPipelineBucket {
  const { stage, disposition, recruiterInterest } = input;

  if (disposition === "REJECTED") return "REJECTED";
  if (disposition === "HIRED") return "HIRED";
  if (disposition === "WITHDRAWN" || disposition === "CANCELLED") {
    return "CLOSED_OTHER";
  }
  if (disposition === "HOLD" && stage !== "CLOSED") return "HOLD";
  if (stage === "CLOSED") return "CLOSED_OTHER";

  switch (stage) {
    case "APPLIED":
      return "APPLIED";
    case "REVIEW":
      return recruiterInterest === "MAYBE" ? "PRESELECTED" : "REVIEW";
    case "ASSESSMENT":
      return "ASSESSMENT";
    case "INTERVIEW":
      return "INTERVIEW";
    case "OFFER":
      return "OFFER";
    default:
      return "CLOSED_OTHER";
  }
}

export function getRecruiterApplicationReadModel(
  input: RecruiterApplicationReadInput,
  options: { canonicalReadsEnabled: boolean },
): RecruiterApplicationReadModel {
  const hasCompleteCanonicalState =
    input.stage !== null && input.disposition !== null;
  const source: RecruiterReadModelSource =
    options.canonicalReadsEnabled && hasCompleteCanonicalState
      ? "CANONICAL"
      : "LEGACY_FALLBACK";
  const bucket =
    source === "CANONICAL" ? canonicalBucket(input) : legacyBucket(input.recruiterInterest);

  return {
    bucket,
    label: RECRUITER_PIPELINE_LABELS[bucket],
    source,
  };
}

export function buildRecruiterApplicationReadRows<
  T extends RecruiterApplicationReadInput,
>(
  applications: readonly T[],
  options: { canonicalReadsEnabled: boolean },
): Array<RecruiterApplicationReadRow<T>> {
  return applications.map((application) => ({
    ...application,
    _recruiterRead: getRecruiterApplicationReadModel(application, options),
  }));
}

export function countRecruiterPipelineBuckets(
  rows: ReadonlyArray<{ _recruiterRead: RecruiterApplicationReadModel }>,
): Record<RecruiterPipelineBucket, number> {
  const counts = Object.fromEntries(
    RECRUITER_PIPELINE_BUCKETS.map((bucket) => [bucket, 0]),
  ) as Record<RecruiterPipelineBucket, number>;

  for (const row of rows) counts[row._recruiterRead.bucket]++;
  return counts;
}

export function filterRecruiterPipelineRows<T extends {
  _recruiterRead: RecruiterApplicationReadModel;
}>(rows: readonly T[], bucket: RecruiterPipelineBucket | undefined): T[] {
  if (!bucket) return [...rows];
  return rows.filter((row) => row._recruiterRead.bucket === bucket);
}

const LEGACY_INTEREST_TO_PIPELINE: Record<string, RecruiterPipelineBucket> = {
  REVIEW: "APPLIED",
  MAYBE: "PRESELECTED",
  ACCEPTED: "INTERVIEW",
  REJECTED: "REJECTED",
};

export function resolveRecruiterPipelineFilter({
  pipeline,
  interest,
}: {
  pipeline?: string;
  interest?: string;
}): RecruiterPipelineBucket | undefined {
  if (
    pipeline &&
    PRIMARY_RECRUITER_PIPELINE_BUCKETS.includes(
      pipeline as (typeof PRIMARY_RECRUITER_PIPELINE_BUCKETS)[number],
    )
  ) {
    return pipeline as RecruiterPipelineBucket;
  }
  if (interest === "ALL") return undefined;
  if (interest && LEGACY_INTEREST_TO_PIPELINE[interest]) {
    return LEGACY_INTEREST_TO_PIPELINE[interest];
  }
  return undefined;
}
