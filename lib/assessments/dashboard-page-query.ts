import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import type { AssessmentState } from "@/lib/assessments/expiration";

export type AssessmentPageOptions = {
  companyId: string | null;
  isAdmin: boolean;
  q: string;
  jobId: string;
  state: AssessmentState | "ALL";
  hasAttempt: string;
  sort: string;
  page: number;
  take: number;
  now: Date;
};

export type AssessmentPageEntry = {
  inviteId: string;
  attemptId: string | null;
  uiState: AssessmentState;
};

type QueryRow = {
  total: number;
  inviteId: string | null;
  attemptId: string | null;
  uiState: AssessmentState | null;
};

export async function selectAssessmentPage(
  options: AssessmentPageOptions
): Promise<{ total: number; rows: AssessmentPageEntry[] }> {
  if (!options.isAdmin && !options.companyId) {
    throw new Error("Company scope required");
  }

  const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (!options.isAdmin) {
    where.push(
      Prisma.sql`job."companyId" = ${options.companyId}`
    );
  }

  if (options.jobId) {
    where.push(Prisma.sql`job.id = ${options.jobId}`);
  }

  if (options.q) {
    where.push(Prisma.sql`(
      POSITION(LOWER(${options.q}) IN LOWER(COALESCE(candidate.name, ''))) > 0
      OR POSITION(LOWER(${options.q}) IN LOWER(candidate.email)) > 0
      OR POSITION(LOWER(${options.q}) IN LOWER(template.title)) > 0
    )`);
  }

  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (options.state !== "ALL") {
    filters.push(
      Prisma.sql`candidate_rows."uiState" = ${options.state}`
    );
  }

  if (options.hasAttempt === "1") {
    filters.push(Prisma.sql`candidate_rows."attemptId" IS NOT NULL`);
  } else if (options.hasAttempt === "0") {
    filters.push(Prisma.sql`candidate_rows."attemptId" IS NULL`);
  }

  let order: Prisma.Sql =
    Prisma.sql`eligible."updatedAt" DESC, eligible."inviteId" ASC`;

  if (options.sort === "score_desc") {
    order = Prisma.sql`
      eligible.score DESC NULLS LAST,
      eligible."updatedAt" DESC,
      eligible."inviteId" ASC
    `;
  } else if (options.sort === "score_asc") {
    order = Prisma.sql`
      eligible.score ASC NULLS LAST,
      eligible."updatedAt" DESC,
      eligible."inviteId" ASC
    `;
  }

  const skip = (options.page - 1) * options.take;
  const end = skip + options.take;
  const now = options.now;

  const sql = Prisma.sql`
    WITH candidate_rows AS (
      SELECT
        invite.id AS "inviteId",
        selected_attempt.id AS "attemptId",
        invite."updatedAt" AS "updatedAt",
        selected_attempt."totalScore" AS score,
        CASE
          WHEN selected_attempt.status::text IN
            ('SUBMITTED', 'EVALUATED', 'COMPLETED')
            THEN 'COMPLETED'
          WHEN invite.status::text IN ('CANCELLED', 'REVOKED')
            THEN 'CANCELLED'
          WHEN selected_attempt.id IS NOT NULL
            AND selected_attempt."expiresAt" <= ${now}
            THEN 'EXPIRED'
          WHEN selected_attempt.status::text = 'IN_PROGRESS'
            AND (
              selected_attempt."expiresAt" IS NULL
              OR selected_attempt."expiresAt" > ${now}
            )
            THEN 'IN_PROGRESS'
          WHEN selected_attempt.status::text = 'NOT_STARTED'
            AND (
              selected_attempt."expiresAt" IS NULL
              OR selected_attempt."expiresAt" > ${now}
            )
            THEN 'PENDING'
          WHEN invite."expiresAt" <= ${now}
            THEN 'EXPIRED'
          WHEN invite.status::text IN
            ('SUBMITTED', 'EVALUATED', 'COMPLETED')
            THEN 'COMPLETED'
          WHEN invite.status::text = 'STARTED'
            THEN 'IN_PROGRESS'
          ELSE 'PENDING'
        END AS "uiState"
      FROM "AssessmentInvite" invite
      INNER JOIN "Application" application
        ON application.id = invite."applicationId"
      INNER JOIN "Job" job
        ON job.id = application."jobId"
      INNER JOIN "User" candidate
        ON candidate.id = invite."candidateId"
      INNER JOIN "AssessmentTemplate" template
        ON template.id = invite."templateId"
      LEFT JOIN LATERAL (
        SELECT attempt.*
        FROM "AssessmentAttempt" attempt
        WHERE attempt."inviteId" = invite.id
          OR (
            attempt."inviteId" IS NULL
            AND attempt."applicationId" = invite."applicationId"
            AND attempt."templateId" = invite."templateId"
            AND attempt."candidateId" = invite."candidateId"
          )
        ORDER BY
          CASE
            WHEN attempt."inviteId" = invite.id THEN 0
            ELSE 1
          END,
          attempt."createdAt" DESC,
          attempt.id DESC
        LIMIT 1
      ) selected_attempt ON TRUE
      WHERE ${Prisma.join(where, " AND ")}
    ),
    eligible AS (
      SELECT *
      FROM candidate_rows
      WHERE ${Prisma.join(filters, " AND ")}
    ),
    ranked AS (
      SELECT
        eligible.*,
        ROW_NUMBER() OVER (ORDER BY ${order}) AS rn
      FROM eligible
    ),
    counted AS (
      SELECT COUNT(*)::integer AS total
      FROM eligible
    )
    SELECT
      counted.total,
      ranked."inviteId",
      ranked."attemptId",
      ranked."uiState"
    FROM counted
    LEFT JOIN ranked
      ON ranked.rn > ${skip}
      AND ranked.rn <= ${end}
    ORDER BY ranked.rn ASC NULLS LAST
  `;

  const result = await prisma.$queryRaw<QueryRow[]>(sql);

  return {
    total: Number(result[0]?.total ?? 0),
    rows: result.flatMap((row) =>
      row.inviteId && row.uiState
        ? [{
            inviteId: row.inviteId,
            attemptId: row.attemptId,
            uiState: row.uiState,
          }]
        : []
    ),
  };
}