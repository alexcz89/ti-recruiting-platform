import type { Prisma } from "@prisma/client";
import { challengeAvailability, type ChallengeWindow } from "@/lib/contests/domain";

export const assessmentAttemptContextSelect = {
  invite: { select: { status: true } },
  contestRegistration: { select: { contest: { select: { status: true, challengeOpens: true, challengeCloses: true } } } },
} satisfies Prisma.AssessmentAttemptSelect;

export function isAssessmentAttemptContextOpen(attempt: {
  invite?: { status: string } | null;
  contestRegistration?: { contest: ChallengeWindow } | null;
}) {
  return attempt.invite?.status !== "CANCELLED" &&
    (!attempt.contestRegistration || challengeAvailability(attempt.contestRegistration.contest).open);
}

/** Uninitialized badge/sample orders fail closed; legacy unsampled attempts keep their fallback. */
export function isAssessmentQuestionAuthorized(flags: unknown, isBadgeExam: boolean, questionId: string) {
  if (flags != null && (typeof flags !== "object" || Array.isArray(flags))) return false;
  const meta = flags as { questionOrder?: unknown; sampled?: unknown } | null | undefined;
  const order = meta?.questionOrder;
  return order !== undefined
    ? Array.isArray(order) && order.every(id => typeof id === "string") && order.includes(questionId)
    : !isBadgeExam && meta?.sampled !== true;
}

export type AssessmentTemplateAccessRole = "RECRUITER" | "ADMIN";

type AssessmentTemplateActor = {
  role: string | null | undefined;
  companyId: string | null | undefined;
};

export function isAssessmentTemplateAccessRole(
  role: string | null | undefined
): role is AssessmentTemplateAccessRole {
  return role === "RECRUITER" || role === "ADMIN";
}

/**
 * Templates an authenticated actor may discover or assign.
 * A null result means the actor is not authorized for the template catalog.
 */
export function getAssessmentTemplateVisibilityWhere(
  actor: AssessmentTemplateActor
): Prisma.AssessmentTemplateWhereInput | null {
  if (actor.role === "ADMIN") return {};

  if (actor.role === "RECRUITER" && actor.companyId) {
    return {
      OR: [{ isGlobal: true }, { companyId: actor.companyId }],
    };
  }

  return null;
}

/**
 * Templates an authenticated actor may modify or remove.
 * Recruiters can manage only private templates owned by their approved company.
 */
export function getAssessmentTemplateManagementWhere(
  actor: AssessmentTemplateActor
): Prisma.AssessmentTemplateWhereInput | null {
  if (actor.role === "ADMIN") return {};

  if (actor.role === "RECRUITER" && actor.companyId) {
    return { companyId: actor.companyId, isGlobal: false };
  }

  return null;
}
