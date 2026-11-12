import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { InterviewStore, StoredInterview } from "./ai-interview-session-service";

/** Parameterized SQL via Prisma keeps the row lock and JSON write on one connection.
 * READ COMMITTED re-reads the winning snapshot after waiting; no automatic retries.
 */
export function createPrismaInterviewStore(db: PrismaClient): InterviewStore {
  return {
    transaction: work => db.$transaction(async tx => work({
      async authorize(scope) {
        const actor = await tx.user.findFirst({ where: {
          id: scope.actorId, isActive: true, isSuspended: false, deletedAt: null,
          OR: [{ role: "ADMIN" }, { role: "RECRUITER", recruiterProfile: { is: { companyId: scope.companyId, status: "APPROVED" } } }],
        }, select: { id: true } });
        if (!actor) return false;
        return Boolean(await tx.application.findFirst({ where: {
          id: scope.applicationId, candidateId: scope.candidateId, job: { companyId: scope.companyId },
          candidate: { role: "CANDIDATE", isActive: true, isSuspended: false, deletedAt: null },
        }, select: { id: true } }));
      },
      async find(scope, sessionId, lock) {
        const rows = await tx.$queryRaw<StoredInterview[]>(Prisma.sql`
          SELECT "id", "companyId", "candidateId", "applicationId", "version", "snapshot" FROM "AIInterviewSession"
          WHERE "id" = ${sessionId} AND "companyId" = ${scope.companyId} AND "candidateId" = ${scope.candidateId} AND "applicationId" = ${scope.applicationId}
          ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`);
        return rows[0] ?? null;
      },
      async now() {
        const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
        return row.now.getTime();
      },
      async insert(scope, snapshot) {
        const [row] = await tx.$queryRaw<StoredInterview[]>`
          INSERT INTO "AIInterviewSession" ("id", "companyId", "candidateId", "applicationId", "snapshot")
          VALUES (${randomUUID()}, ${scope.companyId}, ${scope.candidateId}, ${scope.applicationId}, ${JSON.stringify(snapshot)}::jsonb)
          RETURNING "id", "companyId", "candidateId", "applicationId", "version", "snapshot"`;
        return row;
      },
      async update(scope, row, snapshot) {
        const count = await tx.$executeRaw`
          UPDATE "AIInterviewSession" SET "snapshot" = ${JSON.stringify(snapshot)}::jsonb,
            "version" = "version" + 1, "updatedAt" = clock_timestamp()
          WHERE "id" = ${row.id} AND "companyId" = ${scope.companyId} AND "candidateId" = ${scope.candidateId} AND "applicationId" = ${scope.applicationId} AND "version" = ${row.version}`;
        return count === 1;
      },
    }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 }),
  };
}
