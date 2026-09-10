export const ASSESSMENT_EXPIRED_CODE = "ASSESSMENT_EXPIRED" as const;

export type AssessmentState =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

type Deadline = Date | string | null | undefined;
type StatusWithDeadline = {
  status?: string | null;
  expiresAt?: Deadline;
};

const FINAL_ATTEMPT_STATUSES = new Set(["SUBMITTED", "EVALUATED", "COMPLETED"]);

export function isFinalAttemptStatus(status: string | null | undefined) {
  return FINAL_ATTEMPT_STATUSES.has(String(status ?? "").toUpperCase());
}

export function isAssessmentExpired(expiresAt: Deadline, now = new Date()) {
  if (expiresAt == null) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function attemptIsActive(
  attempt: StatusWithDeadline | null | undefined,
  now = new Date()
) {
  if (!attempt) return false;
  const status = String(attempt.status ?? "").toUpperCase();
  return (
    (status === "NOT_STARTED" || status === "IN_PROGRESS") &&
    !isAssessmentExpired(attempt.expiresAt, now)
  );
}

export function assessmentState(
  invite: StatusWithDeadline | null | undefined,
  attempt: StatusWithDeadline | null | undefined,
  now = new Date()
): AssessmentState {
  const attemptStatus = String(attempt?.status ?? "").toUpperCase();
  if (isFinalAttemptStatus(attemptStatus)) return "COMPLETED";
  const inviteStatus = String(invite?.status ?? "").toUpperCase();
  if (inviteStatus === "CANCELLED" || inviteStatus === "REVOKED") {
    return "CANCELLED";
  }
  if (attempt && isAssessmentExpired(attempt.expiresAt, now)) return "EXPIRED";
  if (attemptStatus === "IN_PROGRESS" && attemptIsActive(attempt, now)) {
    return "IN_PROGRESS";
  }
  if (attemptStatus === "NOT_STARTED" && attemptIsActive(attempt, now)) {
    return "PENDING";
  }

  if (isAssessmentExpired(invite?.expiresAt, now)) return "EXPIRED";
  if (FINAL_ATTEMPT_STATUSES.has(inviteStatus)) return "COMPLETED";
  if (inviteStatus === "STARTED") return "IN_PROGRESS";
  return "PENDING";
}

export function computeAttemptExpiresAt(
  startedAt: Date,
  timeLimitMinutes: number | null | undefined
) {
  if (!timeLimitMinutes || timeLimitMinutes <= 0) return null;
  return new Date(startedAt.getTime() + timeLimitMinutes * 60_000);
}

export function computeInviteExpiresAt(startedAt: Date, days: number) {
  return new Date(startedAt.getTime() + days * 24 * 60 * 60_000);
}

export function inviteResendAction(
  invite: StatusWithDeadline,
  attempts: { hasActiveAttempt: boolean; hasLinkedAttempt: boolean },
  now = new Date()
): "PRESERVE" | "RENEW" | "ROTATE" {
  if (attempts.hasActiveAttempt) return "PRESERVE";

  const status = String(invite.status ?? "").toUpperCase();
  const reusable =
    (status === "SENT" || status === "STARTED") &&
    !isAssessmentExpired(invite.expiresAt, now);

  return reusable && !attempts.hasLinkedAttempt ? "RENEW" : "ROTATE";
}
