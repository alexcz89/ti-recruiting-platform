import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { interviewRecruiterWhere } from "./ai-interview-authorization";
import type { BlueprintStore, StoredBlueprintVersion } from "./ai-interview-blueprint-service";

const fields = Prisma.sql`"id", "companyId", "jobId", "blueprint", "status", "createdById", "approvedById", "approvedAt", "fingerprint", "createdAt"`;

/** Same transaction/row-lock strategy as interview persistence. No content
 * UPDATE exists: changes require a new ID. SQL parameters never contain code.
 */
export function createPrismaInterviewBlueprintStore(db: PrismaClient): BlueprintStore {
  return {
    transaction: work => db.$transaction(async tx => work({
      async authorize(scope) {
        const actor = await tx.user.findFirst({ where: interviewRecruiterWhere(scope.actorId, scope.companyId), select: { id: true } });
        if (!actor) return false;
        return Boolean(await tx.job.findFirst({ where: { id: scope.jobId, companyId: scope.companyId }, select: { id: true } }));
      },
      async find(scope, id, lock) {
        const rows = await tx.$queryRaw<StoredBlueprintVersion[]>(Prisma.sql`
          SELECT ${fields} FROM "AIInterviewBlueprintVersion"
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "jobId" = ${scope.jobId}
          ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`);
        return rows[0] ?? null;
      },
      async insert(scope, blueprint) {
        const [row] = await tx.$queryRaw<StoredBlueprintVersion[]>(Prisma.sql`
          INSERT INTO "AIInterviewBlueprintVersion" ("id", "companyId", "jobId", "blueprint", "createdById")
          VALUES (${randomUUID()}, ${scope.companyId}, ${scope.jobId}, ${JSON.stringify(blueprint)}::jsonb, ${scope.actorId})
          RETURNING ${fields}`);
        return row;
      },
      async approve(scope, id, fingerprint) {
        const rows = await tx.$queryRaw<StoredBlueprintVersion[]>(Prisma.sql`
          UPDATE "AIInterviewBlueprintVersion" SET "status" = 'APPROVED', "approvedById" = ${scope.actorId},
            "approvedAt" = clock_timestamp(), "fingerprint" = ${fingerprint}
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "jobId" = ${scope.jobId} AND "status" = 'DRAFT'
          RETURNING ${fields}`);
        return rows[0] ?? null;
      },
      async revoke(scope, id) {
        const rows = await tx.$queryRaw<StoredBlueprintVersion[]>(Prisma.sql`
          UPDATE "AIInterviewBlueprintVersion" SET "status" = 'REVOKED'
          WHERE "id" = ${id} AND "companyId" = ${scope.companyId} AND "jobId" = ${scope.jobId} AND "status" = 'APPROVED'
          RETURNING ${fields}`);
        return rows[0] ?? null;
      },
    }), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 }),
  };
}
