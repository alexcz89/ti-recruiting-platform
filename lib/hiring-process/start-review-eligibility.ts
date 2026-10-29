type ReviewSource = {
  stage: string | null;
  disposition: string | null;
  stateVersion: number;
  status: string;
  recruiterInterest: string;
  offerAt?: Date | string | null;
  hiredAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  interviewAt?: Date | string | null;
  rejectionEmailSent?: boolean;
};

/** Shared source eligibility; the writer reauthorizes the actor and persisted state. */
export function canStartReview(source: ReviewSource) {
  if (source.status !== "SUBMITTED" || source.recruiterInterest !== "REVIEW" ||
      source.offerAt || source.hiredAt || source.rejectedAt || source.interviewAt || source.rejectionEmailSent) return false;
  if (source.stage !== null && source.disposition !== null) {
    return source.stage === "APPLIED" && source.disposition === "ACTIVE";
  }
  return source.stage === null && source.disposition === null &&
    source.stateVersion === 0;
}
