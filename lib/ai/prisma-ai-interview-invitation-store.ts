import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { interviewRecruiterWhere } from "./ai-interview-authorization";
import { createPrismaInterviewTransaction } from "./prisma-ai-interview-session-store";
import type { InterviewApplication, InterviewInvitation, InvitationStore } from "./ai-interview-invitation-service";

export function createPrismaInterviewInvitationStore(db: PrismaClient): InvitationStore {
  return { transaction: work => db.$transaction(async tx => {
    const sessions = createPrismaInterviewTransaction(tx);
    const candidateActive = async (actorId: string) => Boolean(await tx.user.findFirst({
      where: { id: actorId, role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null }, select: { id: true },
    }));
    return work({
      sessions,
      async authorizeCancellation(scope) {
        // Cancellation remains available when the candidate is disabled or the
        // hiring process has closed. Actor approval and tenant scope still apply.
        const actor = await tx.user.findFirst({ where: interviewRecruiterWhere(scope.actorId, scope.companyId), select: { id: true } });
        return Boolean(actor && await tx.application.findFirst({ where: {
          id: scope.applicationId, candidateId: scope.candidateId, job: { companyId: scope.companyId },
        }, select: { id: true } }));
      },
      async application(scope) {
        const [app] = await tx.$queryRaw<InterviewApplication[]>`
          SELECT a."stage", a."disposition", a."status", a."recruiterInterest", a."stateVersion",
            a."hiredAt", a."rejectedAt", a."rejectionEmailSent", j."status" AS "jobStatus"
          FROM "Application" a JOIN "Job" j ON j."id" = a."jobId"
          WHERE a."id" = ${scope.applicationId} AND a."candidateId" = ${scope.candidateId}
            AND j."companyId" = ${scope.companyId} FOR SHARE OF a, j`;
        return app ?? null;
      },
      async lockRequest(companyId, requestId) {
        // The SELECT returns integer, never the PostgreSQL void lock result.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${JSON.stringify([companyId, requestId])}))`;
      },
      async request(companyId, requestId) {
        const [row] = await tx.$queryRaw<InterviewInvitation[]>`SELECT * FROM "AIInterviewSession"
          WHERE "companyId" = ${companyId} AND "invitationRequestId" = ${requestId}`;
        return row ?? null;
      },
      async find(scope, id) {
        const [row] = await tx.$queryRaw<InterviewInvitation[]>`SELECT * FROM "AIInterviewSession"
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "candidateId" = ${scope.candidateId}
            AND "applicationId" = ${scope.applicationId} FOR UPDATE`;
        return row ?? null;
      },
      async candidate(actorId, id) {
        if (!await candidateActive(actorId)) return null;
        const [row] = await tx.$queryRaw<InterviewInvitation[]>`SELECT * FROM "AIInterviewSession"
          WHERE "id" = ${id} AND "candidateId" = ${actorId} FOR UPDATE`;
        if (!row || !await candidateActive(actorId)) return null;
        return row;
      },
      async stamp(scope, id, requestId, fingerprint, expiresAt) {
        const [row] = await tx.$queryRaw<InterviewInvitation[]>`UPDATE "AIInterviewSession"
          SET "invitedById" = ${scope.actorId}, "invitedAt" = clock_timestamp(), "invitationExpiresAt" = ${expiresAt},
            "invitationRequestId" = ${requestId}, "invitationFingerprint" = ${fingerprint}
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "candidateId" = ${scope.candidateId}
            AND "applicationId" = ${scope.applicationId} AND "invitedAt" IS NULL RETURNING *`;
        if (!row) throw new Error("Invitation persistence conflict");
        return row;
      },
      async cancel(scope, id) {
        await tx.$executeRaw`UPDATE "AIInterviewSession" SET "invitationCancelledAt" = clock_timestamp(),
          "invitationCancelledById" = ${scope.actorId}
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "candidateId" = ${scope.candidateId}
            AND "applicationId" = ${scope.applicationId} AND "invitedAt" IS NOT NULL AND "invitationCancelledAt" IS NULL`;
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 }) };
}
