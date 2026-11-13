import type { Prisma } from "@prisma/client";

/** Shared interview-only policy. actorId must come from trusted server identity. */
export function interviewRecruiterWhere(actorId: string, companyId: string): Prisma.UserWhereInput {
  return {
    id: actorId, isActive: true, isSuspended: false, deletedAt: null,
    role: "RECRUITER",
    recruiterProfile: { is: { companyId, status: "APPROVED" } },
  };
}
