import type { Prisma } from "@prisma/client";

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
