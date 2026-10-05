import "server-only";

import { z } from "zod";

import { applicationWhereForActor } from "@/lib/server/candidate-access";
import { prisma } from "@/lib/server/prisma";

import { isCanonicalHiringProcessEnabled } from "./feature-flags";
import { InvalidApplicationTransitionError } from "./rules";
import {
  ApplicationNotFoundError,
  CanonicalStateUnavailableError,
  ConcurrentApplicationTransitionError,
  transitionApplication,
  UnauthorizedApplicationTransitionError,
  type TransitionActor,
} from "./transition-application";

export const APPLICATION_INTENTS = [
  "START_REVIEW",
  "MOVE_TO_INTERVIEW",
  "REJECT_CANDIDATE",
] as const;

export type ApplicationIntent = (typeof APPLICATION_INTENTS)[number];

export const applicationIntentSchema = z
  .object({
    intent: z.enum(APPLICATION_INTENTS),
    expectedVersion: z.number().int().nonnegative(),
    commandId: z.string().trim().min(1).max(200),
  })
  .strict();

export type ApplicationIntentCommand = z.infer<typeof applicationIntentSchema>;

export function applicationIntentTarget(intent: ApplicationIntent) {
  switch (intent) {
    case "START_REVIEW":
      return { targetStage: "REVIEW" as const, targetDisposition: "ACTIVE" as const };
    case "MOVE_TO_INTERVIEW":
      return { targetStage: "INTERVIEW" as const, targetDisposition: "ACTIVE" as const };
    case "REJECT_CANDIDATE":
      return { targetStage: "CLOSED" as const, targetDisposition: "REJECTED" as const };
  }
}

function legacyProjectionForIntent(intent: ApplicationIntent) {
  switch (intent) {
    case "START_REVIEW":
      return { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const };
    case "MOVE_TO_INTERVIEW":
      return { status: "INTERVIEW" as const, recruiterInterest: "ACCEPTED" as const };
    case "REJECT_CANDIDATE":
      return { status: "REJECTED" as const, recruiterInterest: "REJECTED" as const };
  }
}

const REJECTION_SOURCE_STAGES = new Set([
  "APPLIED",
  "REVIEW",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
]);

export async function executeApplicationIntent(input: {
  applicationId: string;
  command: ApplicationIntentCommand;
  actor: TransitionActor;
}) {
  const { applicationId, command, actor } = input;

  if (
    command.intent === "REJECT_CANDIDATE" &&
    (!actor.id || (actor.type !== "RECRUITER" && actor.type !== "ADMIN"))
  ) {
    throw new UnauthorizedApplicationTransitionError();
  }

  if (isCanonicalHiringProcessEnabled()) {
    if (command.intent === "REJECT_CANDIDATE") {
      const scopedWhere = applicationWhereForActor(
        { role: actor.type, companyId: actor.companyId ?? null },
        { applicationId },
      );
      if (!scopedWhere) throw new UnauthorizedApplicationTransitionError();

      const source = await prisma.application.findFirst({
        where: scopedWhere,
        select: { stage: true, disposition: true },
      });
      if (!source) throw new ApplicationNotFoundError();

      const isPotentialReplay =
        source.stage === "CLOSED" && source.disposition === "REJECTED";
      const isApprovedSource =
        source.disposition === "ACTIVE" &&
        source.stage !== null &&
        REJECTION_SOURCE_STAGES.has(source.stage);
      if (!isApprovedSource && !isPotentialReplay) {
        throw new InvalidApplicationTransitionError(
          "REJECT_CANDIDATE requiere una etapa activa no terminal",
        );
      }
    }

    const result = await transitionApplication({
      applicationId,
      ...applicationIntentTarget(command.intent),
      expectedVersion: command.expectedVersion,
      actor,
      idempotencyKey: command.commandId,
    });
    return {
      ...result,
      legacy: {
        ...legacyProjectionForIntent(command.intent),
        stateVersion: result.state.stateVersion,
      },
    };
  }

  const scopedWhere = applicationWhereForActor(
    { role: actor.type, companyId: actor.companyId ?? null },
    { applicationId },
  );
  if (!scopedWhere) throw new UnauthorizedApplicationTransitionError();

  if (command.intent === "REJECT_CANDIDATE") {
    const actorId = actor.id;
    if (!actorId || (actor.type !== "RECRUITER" && actor.type !== "ADMIN")) {
      throw new UnauthorizedApplicationTransitionError();
    }
    const persistedActor = await prisma.user.findFirst({
      where: actor.type === "ADMIN"
        ? {
            id: actorId,
            role: "ADMIN",
            isActive: true,
            isSuspended: false,
            deletedAt: null,
          }
        : {
            id: actorId,
            role: "RECRUITER",
            isActive: true,
            isSuspended: false,
            deletedAt: null,
            recruiterProfile: {
              is: {
                companyId: actor.companyId ?? "__missing_company__",
                status: "APPROVED",
              },
            },
          },
      select: { id: true },
    });
    if (!persistedActor) throw new UnauthorizedApplicationTransitionError();
  }

  const application = await prisma.application.findFirst({
    where: scopedWhere,
    select: {
      id: true,
      stage: true,
      disposition: true,
      stateVersion: true,
      status: true,
      recruiterInterest: true,
      rejectedAt: true,
    },
  });
  if (!application) throw new ApplicationNotFoundError();
  if (
    application.stage !== null ||
    application.disposition !== null ||
    application.stateVersion !== 0
  ) {
    throw new CanonicalStateUnavailableError();
  }
  if (application.stateVersion !== command.expectedVersion) {
    throw new ConcurrentApplicationTransitionError();
  }

  // Temporary legacy exception: removed when the canonical flag becomes authoritative.
  const projection = legacyProjectionForIntent(command.intent);
  if (
    command.intent === "REJECT_CANDIDATE" &&
    application.status === "REJECTED" &&
    application.recruiterInterest === "REJECTED"
  ) {
    return {
      state: null,
      event: null,
      replayed: true,
      legacyProjectionApplied: true,
      legacy: { ...projection, stateVersion: application.stateVersion },
    };
  }

  const happenedAt = new Date();
  const hasPartialLegacyRejection =
    command.intent === "REJECT_CANDIDATE" &&
    (application.status === "REJECTED" ||
      application.recruiterInterest === "REJECTED");
  const updated = await prisma.application.updateMany({
    where: {
      id: application.id,
      stage: null,
      disposition: null,
      stateVersion: 0,
      status: application.status,
      recruiterInterest: application.recruiterInterest,
      rejectedAt: application.rejectedAt,
    },
    data: {
      ...projection,
      ...(command.intent === "START_REVIEW" ? { reviewingAt: happenedAt } : {}),
      ...(command.intent === "MOVE_TO_INTERVIEW" ? { interviewAt: happenedAt } : {}),
      ...(command.intent === "REJECT_CANDIDATE"
        ? {
            rejectedAt:
              hasPartialLegacyRejection && application.rejectedAt
                ? application.rejectedAt
                : happenedAt,
            ...(hasPartialLegacyRejection
              ? {}
              : { rejectionEmailSent: false }),
          }
        : {}),
    },
  });
  if (updated.count !== 1) throw new ConcurrentApplicationTransitionError();

  return {
    state: null,
    event: null,
    replayed: false,
    legacyProjectionApplied: true,
    legacy: { ...projection, stateVersion: application.stateVersion },
  };
}
