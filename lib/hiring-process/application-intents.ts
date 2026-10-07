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
  "MOVE_TO_OFFER",
  "REJECT_CANDIDATE",
  "HIRE_CANDIDATE",
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
    case "MOVE_TO_OFFER":
      return { targetStage: "OFFER" as const, targetDisposition: "ACTIVE" as const };
    case "REJECT_CANDIDATE":
      return { targetStage: "CLOSED" as const, targetDisposition: "REJECTED" as const };
    case "HIRE_CANDIDATE":
      return { targetStage: "CLOSED" as const, targetDisposition: "HIRED" as const };
  }
}

function legacyProjectionForIntent(intent: ApplicationIntent) {
  switch (intent) {
    case "START_REVIEW":
      return { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const };
    case "MOVE_TO_INTERVIEW":
      return { status: "INTERVIEW" as const, recruiterInterest: "ACCEPTED" as const };
    case "MOVE_TO_OFFER":
      return { status: "OFFER" as const, recruiterInterest: "ACCEPTED" as const };
    case "REJECT_CANDIDATE":
      return { status: "REJECTED" as const, recruiterInterest: "REJECTED" as const };
    case "HIRE_CANDIDATE":
      return { status: "HIRED" as const, recruiterInterest: "ACCEPTED" as const };
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
    (command.intent === "REJECT_CANDIDATE" ||
      command.intent === "MOVE_TO_OFFER" ||
      command.intent === "HIRE_CANDIDATE") &&
    (!actor.id || (actor.type !== "RECRUITER" && actor.type !== "ADMIN"))
  ) {
    throw new UnauthorizedApplicationTransitionError();
  }

  if (isCanonicalHiringProcessEnabled()) {
    if (command.intent === "HIRE_CANDIDATE") {
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
        source.stage === "CLOSED" && source.disposition === "HIRED";
      const isApprovedSource =
        source.stage === "OFFER" && source.disposition === "ACTIVE";
      if (!isApprovedSource && !isPotentialReplay) {
        throw new InvalidApplicationTransitionError(
          "HIRE_CANDIDATE requiere OFFER / ACTIVE",
        );
      }
    }

    if (command.intent === "MOVE_TO_OFFER") {
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
        source.stage === "OFFER" && source.disposition === "ACTIVE";
      const isApprovedSource =
        source.stage === "INTERVIEW" && source.disposition === "ACTIVE";
      if (!isApprovedSource && !isPotentialReplay) {
        throw new InvalidApplicationTransitionError(
          "MOVE_TO_OFFER requiere INTERVIEW / ACTIVE",
        );
      }
    }

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

  if (
    command.intent === "REJECT_CANDIDATE" ||
    command.intent === "MOVE_TO_OFFER" ||
    command.intent === "HIRE_CANDIDATE"
  ) {
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
      offerAt: true,
      hiredAt: true,
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
  const hasLegacyHiredFootprint = application.status === "HIRED";

  if (command.intent === "HIRE_CANDIDATE") {
    const isExactLegacyRetry =
      application.status === "HIRED" &&
      application.recruiterInterest === "ACCEPTED";
    if (isExactLegacyRetry) {
      return {
        state: null,
        event: null,
        replayed: true,
        legacyProjectionApplied: true,
        timestamps: {
          offerAt: application.offerAt,
          hiredAt: application.hiredAt,
        },
        legacy: { ...projection, stateVersion: application.stateVersion },
      };
    }

    const isExactLegacySource =
      application.status === "OFFER" &&
      application.recruiterInterest === "ACCEPTED";
    if (!isExactLegacySource) {
      throw new InvalidApplicationTransitionError(
        "HIRE_CANDIDATE legacy requiere OFFER / ACCEPTED",
      );
    }
  } else if (hasLegacyHiredFootprint) {
    throw new InvalidApplicationTransitionError(
      "HIRED es terminal y no admite otra transición legacy",
    );
  }

  if (command.intent === "MOVE_TO_OFFER") {
    const isExactLegacyRetry =
      application.status === "OFFER" &&
      application.recruiterInterest === "ACCEPTED";
    if (isExactLegacyRetry) {
      return {
        state: null,
        event: null,
        replayed: true,
        legacyProjectionApplied: true,
        timestamps: {
          offerAt: application.offerAt,
          hiredAt: application.hiredAt,
        },
        legacy: { ...projection, stateVersion: application.stateVersion },
      };
    }

    const isExactLegacySource =
      application.status === "INTERVIEW" &&
      application.recruiterInterest === "ACCEPTED";
    if (!isExactLegacySource) {
      throw new InvalidApplicationTransitionError(
        "MOVE_TO_OFFER legacy requiere INTERVIEW / ACCEPTED",
      );
    }
  }

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
      timestamps: {
        offerAt: application.offerAt,
        hiredAt: application.hiredAt,
      },
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
      offerAt: application.offerAt,
      rejectedAt: application.rejectedAt,
    },
    data: {
      ...projection,
      ...(command.intent === "START_REVIEW" ? { reviewingAt: happenedAt } : {}),
      ...(command.intent === "MOVE_TO_INTERVIEW" ? { interviewAt: happenedAt } : {}),
      ...(command.intent === "MOVE_TO_OFFER"
        ? { offerAt: application.offerAt ?? happenedAt }
        : {}),
      ...(command.intent === "HIRE_CANDIDATE"
        ? { hiredAt: application.hiredAt ?? happenedAt }
        : {}),
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
    timestamps: {
      offerAt:
        command.intent === "MOVE_TO_OFFER"
          ? application.offerAt ?? happenedAt
          : application.offerAt,
      hiredAt:
        command.intent === "HIRE_CANDIDATE"
          ? application.hiredAt ?? happenedAt
          : application.hiredAt,
    },
    legacy: { ...projection, stateVersion: application.stateVersion },
  };
}
