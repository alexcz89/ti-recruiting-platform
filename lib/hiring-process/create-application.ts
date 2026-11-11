import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";

import { isCanonicalHiringProcessEnabled } from "./feature-flags";

export class JobNotOpenForApplicationsError extends Error {
  constructor() {
    super("Esta vacante ya no recibe postulaciones");
    this.name = "JobNotOpenForApplicationsError";
  }
}

async function lockOpenJob(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<{ companyId: string }> {
  const rows = await tx.$queryRaw<
    Array<{ companyId: string; status: string }>
  >`
    SELECT "companyId", "status"
    FROM "Job"
    WHERE "id" = ${jobId}
    FOR SHARE
  `;

  const job = rows[0];

  if (!job || job.status !== "OPEN") {
    throw new JobNotOpenForApplicationsError();
  }

  return { companyId: job.companyId };
}

export type CreateCanonicalApplicationInput = {
  jobId: string;
  candidateId: string;
  coverLetter: string;
  resumeUrl: string | null;
  happenedAt?: Date;
};

/**
 * Creates the initial snapshot and its first ledger event atomically.
 * Version 1 represents the one-event chain headed by APPLICATION_CREATED.
 */
export async function createCanonicalApplication(
  input: CreateCanonicalApplicationInput,
) {
  const happenedAt = input.happenedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const job = await lockOpenJob(tx, input.jobId);
    const application = await tx.application.create({
      data: {
        jobId: input.jobId,
        candidateId: input.candidateId,
        coverLetter: input.coverLetter,
        resumeUrl: input.resumeUrl,
        stage: "APPLIED",
        disposition: "ACTIVE",
        stateVersion: 1,
        status: "SUBMITTED",
        recruiterInterest: "REVIEW",
        submittedAt: happenedAt,
      },
      select: { id: true },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId: application.id,
        companyId: job.companyId,
        actorType: "CANDIDATE",
        actorId: input.candidateId,
        type: "APPLICATION_CREATED",
        fromStage: null,
        toStage: "APPLIED",
        fromDisposition: null,
        toDisposition: "ACTIVE",
        visibility: "INTERNAL",
        happenedAt,
        idempotencyKey: `application-created:${application.id}`,
        metadata: {
          schemaVersion: 1,
          legacyProjection: "SAFE_AUTO_MAP",
          legacyProjectionApplied: true,
          resultingStateVersion: 1,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return application;
  });
}

/**
 * The flag selects representation only at creation. Persisted applications route
 * by representation even after the flag changes (including rollback).
 * Notifications remain outside this helper so both paths share the same side effects.
 */
export async function createApplicationForHiringProcessRollout(
  input: CreateCanonicalApplicationInput,
) {
  if (isCanonicalHiringProcessEnabled()) {
    return createCanonicalApplication(input);
  }

  return prisma.$transaction(async (tx) => {
    await lockOpenJob(tx, input.jobId);

    return tx.application.create({
      data: {
        jobId: input.jobId,
        candidateId: input.candidateId,
        coverLetter: input.coverLetter,
        resumeUrl: input.resumeUrl,
        stage: null,
        disposition: null,
        stateVersion: 0,
        status: "SUBMITTED",
        recruiterInterest: "REVIEW",
      },
      select: { id: true },
    });
  });
}
