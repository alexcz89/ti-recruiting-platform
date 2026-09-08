import "server-only";

import type { Prisma } from "@prisma/client";

export type CandidateAccessActor = {
  role: string | null | undefined;
  companyId: string | null;
};

/**
 * Canonical backend scope for candidate records. UI filters are never treated
 * as an authorization boundary.
 */
export function candidateWhereForActor(
  actor: CandidateAccessActor,
  candidateId?: string
): Prisma.UserWhereInput | null {
  const role = String(actor.role ?? "").toUpperCase();
  if (role === "ADMIN") {
    return { ...(candidateId ? { id: candidateId } : {}), role: "CANDIDATE" };
  }

  if (role !== "RECRUITER" || !actor.companyId) return null;

  return {
    ...(candidateId ? { id: candidateId } : {}),
    role: "CANDIDATE",
    applications: {
      some: { job: { companyId: actor.companyId } },
    },
  };
}

/**
 * Scopes an application identifier, optional job identifier, and optional
 * candidate identifier as one indivisible tenant check. This prevents IDOR by
 * mixing identifiers from different companies.
 */
export function applicationWhereForActor(
  actor: CandidateAccessActor,
  input: { applicationId?: string; jobId?: string; candidateId?: string }
): Prisma.ApplicationWhereInput | null {
  const role = String(actor.role ?? "").toUpperCase();
  const identifiers = {
    ...(input.applicationId ? { id: input.applicationId } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.candidateId ? { candidateId: input.candidateId } : {}),
  };

  if (role === "ADMIN") return identifiers;
  if (role !== "RECRUITER" || !actor.companyId) return null;

  return { ...identifiers, job: { companyId: actor.companyId } };
}
