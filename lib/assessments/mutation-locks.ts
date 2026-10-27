import "server-only";
import type { Prisma } from "@prisma/client";

export async function lockAssessmentInviteTx(tx: Prisma.TransactionClient, inviteId: string) {
  await tx.$queryRaw`SELECT id FROM "AssessmentInvite" WHERE id = ${inviteId} FOR UPDATE`;
}

/**
 * Mutation order: attempt -> effective invite -> ledger/company. Cancellation
 * locks only the invite and NEVER locks attempts: its plain reads are safe
 * because an attempt cannot mutate/close while another transaction owns that
 * invite lock. This avoids an invite -> attempt / attempt -> invite cycle.
 * Include legacy unlinked attempts using the exact application/candidate/template.
 */
export async function lockAssessmentAttemptTx(tx: Prisma.TransactionClient, attemptId: string) {
  await tx.$queryRaw`SELECT id FROM "AssessmentAttempt" WHERE id = ${attemptId} FOR UPDATE`;
  const invites = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT i.id, i.status::text AS status
    FROM "AssessmentInvite" i
    JOIN "AssessmentAttempt" a ON (
      i.id = a."inviteId" OR
      (a."inviteId" IS NULL AND i."applicationId" = a."applicationId"
       AND i."candidateId" = a."candidateId" AND i."templateId" = a."templateId")
    )
    WHERE a.id = ${attemptId}
    FOR UPDATE OF i`;
  return invites[0] ?? null;
}
