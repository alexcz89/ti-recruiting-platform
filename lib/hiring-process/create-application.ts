import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";

import { isCanonicalHiringProcessEnabled } from "./feature-flags";

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
    const job = await tx.job.findUniqueOrThrow({
      where: { id: input.jobId },
      select: { companyId: true },
    });
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
 * Keeps new applications fully legacy until the canonical process is authoritative.
 * Notifications remain outside this helper so both paths share the same side effects.
 */
export async function createApplicationForHiringProcessRollout(
  input: CreateCanonicalApplicationInput,
) {
  if (isCanonicalHiringProcessEnabled()) {
    return createCanonicalApplication(input);
  }

  return prisma.application.create({
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
}
