const OPERATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OPERATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type AssessmentResendOperation = {
  id: string;
  requestedAt: Date;
};

export function createAssessmentResendBody(templateId: string) {
  return {
    templateId,
    resendOperationId: globalThis.crypto.randomUUID(),
    resendRequestedAt: new Date().toISOString(),
  };
}

export function resolveAssessmentResendOperation(
  input: { resendOperationId?: unknown; resendRequestedAt?: unknown },
  now = new Date(),
): AssessmentResendOperation {
  const rawId =
    typeof input.resendOperationId === "string"
      ? input.resendOperationId.trim()
      : "";
  const rawRequestedAt =
    typeof input.resendRequestedAt === "string"
      ? input.resendRequestedAt
      : "";
  const requestedAt = new Date(rawRequestedAt);
  const ageMs = now.getTime() - requestedAt.getTime();

  if (
    OPERATION_ID_PATTERN.test(rawId) &&
    Number.isFinite(requestedAt.getTime()) &&
    ageMs <= OPERATION_MAX_AGE_MS &&
    ageMs >= -OPERATION_MAX_FUTURE_SKEW_MS
  ) {
    return { id: rawId, requestedAt };
  }

  return { id: globalThis.crypto.randomUUID(), requestedAt: now };
}

export function assessmentInviteEmailDedupeKey(
  inviteId: string,
  operationId: string,
) {
  return `${inviteId}:${operationId}`;
}
