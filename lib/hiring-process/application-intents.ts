import "server-only";

import { z } from "zod";

import { applicationWhereForActor } from "@/lib/server/candidate-access";
import { prisma } from "@/lib/server/prisma";

import { isCanonicalHiringProcessEnabled } from "./feature-flags";
import { InvalidApplicationTransitionError } from "./rules";
import {
  APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
  hasApplicationRejectionFootprint,
} from "./rejection-footprint";
import { APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE } from "./offer-footprint";
import {
  APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
  hasApplicationHiredFootprint,
} from "./hired-footprint";
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
  "MARK_PRESELECTED",
  "CLEAR_PRESELECTED",
  "MOVE_BACKWARD",
  "REOPEN_REJECTED",
] as const;

export type ApplicationIntent = (typeof APPLICATION_INTENTS)[number];

const baseCommandShape = {
    expectedVersion: z.number().int().nonnegative(),
    commandId: z.string().trim().min(1).max(200),
};

export const APPLICATION_TRANSITION_REASON_CODES = [
  "CORRECTION",
  "PROCESS_CHANGE",
  "ADDITIONAL_REVIEW",
  "NEW_INFORMATION",
  "RECONSIDERED",
  "OTHER",
] as const;

const reasonShape = {
  reasonCode: z.enum(APPLICATION_TRANSITION_REASON_CODES),
  reasonText: z.string().trim().max(500).optional(),
};

export const applicationIntentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.enum([
      "START_REVIEW",
      "MOVE_TO_INTERVIEW",
      "MOVE_TO_OFFER",
      "REJECT_CANDIDATE",
      "HIRE_CANDIDATE",
      "MARK_PRESELECTED",
      "CLEAR_PRESELECTED",
    ]),
    ...baseCommandShape,
  }).strict(),
  z.object({
    intent: z.literal("MOVE_BACKWARD"),
    ...baseCommandShape,
    targetStage: z.enum(["REVIEW", "INTERVIEW"]),
    ...reasonShape,
  }).strict(),
  z.object({
    intent: z.literal("REOPEN_REJECTED"),
    ...baseCommandShape,
    ...reasonShape,
  }).strict(),
]).superRefine((command, context) => {
  if (
    (command.intent === "MOVE_BACKWARD" || command.intent === "REOPEN_REJECTED") &&
    command.reasonCode === "OTHER" &&
    !command.reasonText?.trim()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonText"],
      message: "reasonText es obligatorio cuando reasonCode es OTHER",
    });
  }
});

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
    case "MARK_PRESELECTED":
    case "CLEAR_PRESELECTED":
      return { targetStage: "REVIEW" as const, targetDisposition: "ACTIVE" as const };
    case "REOPEN_REJECTED":
      return { targetStage: "REVIEW" as const, targetDisposition: "ACTIVE" as const };
    case "MOVE_BACKWARD":
      throw new InvalidApplicationTransitionError(
        "MOVE_BACKWARD requiere targetStage explícito",
      );
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
    case "MARK_PRESELECTED":
      return { status: "REVIEWING" as const, recruiterInterest: "MAYBE" as const };
    case "CLEAR_PRESELECTED":
      return { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const };
    case "REOPEN_REJECTED":
      return { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const };
    case "MOVE_BACKWARD":
      throw new InvalidApplicationTransitionError(
        "MOVE_BACKWARD requiere targetStage explícito",
      );
  }
}

function legacyProjectionForBackwardTarget(targetStage: "REVIEW" | "INTERVIEW") {
  return targetStage === "REVIEW"
    ? { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const }
    : { status: "INTERVIEW" as const, recruiterInterest: "ACCEPTED" as const };
}

const REJECTION_SOURCE_STAGES = new Set([
  "APPLIED",
  "REVIEW",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
]);

async function assertPersistedPrivilegedActor(actor: TransitionActor) {
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

export async function executeApplicationIntent(input: {
  applicationId: string;
  command: ApplicationIntentCommand;
  actor: TransitionActor;
}) {
  const { applicationId, command, actor } = input;

  if (
    (command.intent === "REJECT_CANDIDATE" ||
      command.intent === "MOVE_TO_OFFER" ||
      command.intent === "HIRE_CANDIDATE" ||
      command.intent === "MARK_PRESELECTED" ||
      command.intent === "CLEAR_PRESELECTED" ||
      command.intent === "MOVE_BACKWARD" ||
      command.intent === "REOPEN_REJECTED") &&
    (!actor.id || (actor.type !== "RECRUITER" && actor.type !== "ADMIN"))
  ) {
    throw new UnauthorizedApplicationTransitionError();
  }

  if (isCanonicalHiringProcessEnabled()) {
    if (
      command.intent === "MOVE_BACKWARD" ||
      command.intent === "REOPEN_REJECTED"
    ) {
      const scopedWhere = applicationWhereForActor(
        { role: actor.type, companyId: actor.companyId ?? null },
        { applicationId },
      );
      if (!scopedWhere) throw new UnauthorizedApplicationTransitionError();
      const source = await prisma.application.findFirst({
        where: scopedWhere,
        select: {
          id: true,
          stage: true,
          disposition: true,
          status: true,
          recruiterInterest: true,
        },
      });
      if (!source) throw new ApplicationNotFoundError();

      const priorCommand = await prisma.applicationEvent.findFirst({
        where: {
          applicationId: source.id,
          idempotencyKey: command.commandId,
        },
        select: { id: true },
      });

      const targetStage = command.intent === "MOVE_BACKWARD"
        ? command.targetStage
        : "REVIEW";
      const projection = legacyProjectionForBackwardTarget(targetStage);
      const isPotentialReplay =
        source.stage === targetStage &&
        source.disposition === "ACTIVE" &&
        source.status === projection.status &&
        source.recruiterInterest === projection.recruiterInterest;

      if (command.intent === "MOVE_BACKWARD") {
        if (
          hasApplicationRejectionFootprint(source) ||
          hasApplicationHiredFootprint(source)
        ) {
          throw new InvalidApplicationTransitionError(
            "MOVE_BACKWARD no admite footprints terminales contradictorios",
          );
        }
        const isApprovedSource =
          source.disposition === "ACTIVE" &&
          ((source.stage === "INTERVIEW" && targetStage === "REVIEW") ||
            (source.stage === "OFFER" &&
              (targetStage === "INTERVIEW" || targetStage === "REVIEW")));
        if (!isApprovedSource && !isPotentialReplay && !priorCommand) {
          throw new InvalidApplicationTransitionError(
            "MOVE_BACKWARD no admite el par source/target solicitado",
          );
        }
      } else {
        const isApprovedSource =
          source.stage === "CLOSED" &&
          source.disposition === "REJECTED" &&
          source.status === "REJECTED" &&
          source.recruiterInterest === "REJECTED";
        if (!isApprovedSource && !isPotentialReplay && !priorCommand) {
          throw new InvalidApplicationTransitionError(
            "REOPEN_REJECTED requiere CLOSED / REJECTED sin footprints ambiguos",
          );
        }
      }

      const result = await transitionApplication({
        applicationId,
        targetStage,
        targetDisposition: "ACTIVE",
        expectedVersion: command.expectedVersion,
        actor,
        idempotencyKey: command.commandId,
        reasonCode: command.reasonCode,
        reasonText: command.reasonText,
        legacyProjectionOverride: projection,
        ...(command.intent === "REOPEN_REJECTED" ? { allowReopen: true } : {}),
      });
      return {
        ...result,
        legacy: { ...projection, stateVersion: result.state.stateVersion },
      };
    }

    if (
      command.intent === "MARK_PRESELECTED" ||
      command.intent === "CLEAR_PRESELECTED"
    ) {
      const scopedWhere = applicationWhereForActor(
        { role: actor.type, companyId: actor.companyId ?? null },
        { applicationId },
      );
      if (!scopedWhere) throw new UnauthorizedApplicationTransitionError();

      const source = await prisma.application.findFirst({
        where: scopedWhere,
        select: {
          id: true,
          stage: true,
          disposition: true,
          stateVersion: true,
          status: true,
          recruiterInterest: true,
          reviewingAt: true,
          offerAt: true,
          hiredAt: true,
        },
      });
      if (!source) throw new ApplicationNotFoundError();
      const isReviewActive =
        source.stage === "REVIEW" && source.disposition === "ACTIVE";

      if (
        command.intent === "MARK_PRESELECTED" &&
        source.stage === "APPLIED" &&
        source.disposition === "ACTIVE"
      ) {
        if (
          source.status !== "SUBMITTED" ||
          source.recruiterInterest !== "REVIEW"
        ) {
          throw new InvalidApplicationTransitionError(
            "MARK_PRESELECTED requiere la proyección SUBMITTED / REVIEW desde APPLIED",
          );
        }
        const result = await transitionApplication({
          applicationId,
          ...applicationIntentTarget(command.intent),
          expectedVersion: command.expectedVersion,
          actor,
          idempotencyKey: command.commandId,
          legacyProjectionOverride: legacyProjectionForIntent(command.intent),
        });
        return {
          ...result,
          legacy: {
            ...legacyProjectionForIntent(command.intent),
            stateVersion: result.state.stateVersion,
          },
        };
      }

      if (!isReviewActive) {
        throw new InvalidApplicationTransitionError(
          `${command.intent} requiere REVIEW / ACTIVE${
            command.intent === "MARK_PRESELECTED" ? " o APPLIED / ACTIVE" : ""
          }`,
        );
      }

      if (source.stateVersion !== command.expectedVersion) {
        if (command.intent === "MARK_PRESELECTED") {
          const result = await transitionApplication({
            applicationId,
            ...applicationIntentTarget(command.intent),
            expectedVersion: command.expectedVersion,
            actor,
            idempotencyKey: command.commandId,
            legacyProjectionOverride: legacyProjectionForIntent(command.intent),
          });
          return {
            ...result,
            legacy: {
              ...legacyProjectionForIntent(command.intent),
              stateVersion: result.state.stateVersion,
            },
          };
        }
        throw new ConcurrentApplicationTransitionError();
      }

      await assertPersistedPrivilegedActor(actor);
      const projection = legacyProjectionForIntent(command.intent);
      if (source.status !== "REVIEWING") {
        throw new InvalidApplicationTransitionError(
          `${command.intent} requiere una proyección REVIEWING compatible`,
        );
      }
      const expectedInterest =
        command.intent === "MARK_PRESELECTED" ? "REVIEW" : "MAYBE";
      const replayInterest = projection.recruiterInterest;
      if (source.recruiterInterest === replayInterest) {
        return {
          state: {
            stage: "REVIEW" as const,
            disposition: "ACTIVE" as const,
            stateVersion: source.stateVersion,
          },
          event: null,
          replayed: true,
          legacyProjectionApplied: true,
          timestamps: { offerAt: source.offerAt, hiredAt: source.hiredAt },
          legacy: { ...projection, stateVersion: source.stateVersion },
        };
      }
      if (
        source.recruiterInterest !== expectedInterest
      ) {
        throw new InvalidApplicationTransitionError(
          `${command.intent} requiere una proyección REVIEWING compatible`,
        );
      }

      const happenedAt = new Date();
      const updated = await prisma.application.updateMany({
        where: {
          AND: [
            scopedWhere,
            APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE,
            APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE,
            APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE,
            {
              stage: "REVIEW",
              disposition: "ACTIVE",
              stateVersion: source.stateVersion,
              status: source.status,
              recruiterInterest: expectedInterest,
            },
          ],
        },
        data: {
          ...projection,
          ...(command.intent === "MARK_PRESELECTED" && !source.reviewingAt
            ? { reviewingAt: happenedAt }
            : {}),
        },
      });
      if (updated.count !== 1) throw new ConcurrentApplicationTransitionError();
      return {
        state: {
          stage: "REVIEW" as const,
          disposition: "ACTIVE" as const,
          stateVersion: source.stateVersion,
        },
        event: null,
        replayed: false,
        legacyProjectionApplied: true,
        timestamps: { offerAt: source.offerAt, hiredAt: source.hiredAt },
        legacy: { ...projection, stateVersion: source.stateVersion },
      };
    }

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
    command.intent === "HIRE_CANDIDATE" ||
    command.intent === "MARK_PRESELECTED" ||
    command.intent === "CLEAR_PRESELECTED" ||
    command.intent === "MOVE_BACKWARD" ||
    command.intent === "REOPEN_REJECTED"
  ) {
    await assertPersistedPrivilegedActor(actor);
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
      reviewingAt: true,
      offerAt: true,
      hiredAt: true,
      rejectedAt: true,
      rejectionEmailSent: true,
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
  const projection = command.intent === "MOVE_BACKWARD"
    ? legacyProjectionForBackwardTarget(command.targetStage)
    : command.intent === "REOPEN_REJECTED"
      ? legacyProjectionForBackwardTarget("REVIEW")
      : legacyProjectionForIntent(command.intent);
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

  if (command.intent === "MOVE_BACKWARD") {
    const isExactRetry =
      application.status === projection.status &&
      application.recruiterInterest === projection.recruiterInterest;
    if (isExactRetry) {
      return {
        state: null,
        event: null,
        replayed: true,
        legacyProjectionApplied: true,
        timestamps: { offerAt: application.offerAt, hiredAt: application.hiredAt },
        legacy: { ...projection, stateVersion: 0 },
      };
    }
    const isApprovedSource =
      application.recruiterInterest === "ACCEPTED" &&
      ((application.status === "INTERVIEW" && command.targetStage === "REVIEW") ||
        (application.status === "OFFER" &&
          (command.targetStage === "INTERVIEW" || command.targetStage === "REVIEW")));
    if (!isApprovedSource) {
      throw new InvalidApplicationTransitionError(
        "MOVE_BACKWARD legacy no admite el par source/target solicitado",
      );
    }
  }

  if (command.intent === "REOPEN_REJECTED") {
    const isExactRetry =
      application.status === "REVIEWING" &&
      application.recruiterInterest === "REVIEW" &&
      application.rejectedAt === null &&
      application.rejectionEmailSent === false;
    if (isExactRetry) {
      return {
        state: null,
        event: null,
        replayed: true,
        legacyProjectionApplied: true,
        timestamps: { offerAt: application.offerAt, hiredAt: application.hiredAt },
        legacy: { ...projection, stateVersion: 0 },
      };
    }
    if (
      application.status !== "REJECTED" ||
      application.recruiterInterest !== "REJECTED"
    ) {
      throw new InvalidApplicationTransitionError(
        "REOPEN_REJECTED legacy requiere REJECTED / REJECTED",
      );
    }
  }

  if (
    command.intent === "MARK_PRESELECTED" ||
    command.intent === "CLEAR_PRESELECTED"
  ) {
    const isMark = command.intent === "MARK_PRESELECTED";
    const isExactLegacyRetry =
      application.status === "REVIEWING" &&
      application.recruiterInterest === projection.recruiterInterest;
    if (isExactLegacyRetry) {
      return {
        state: null,
        event: null,
        replayed: true,
        legacyProjectionApplied: true,
        timestamps: { offerAt: application.offerAt, hiredAt: application.hiredAt },
        legacy: { ...projection, stateVersion: application.stateVersion },
      };
    }

    const isExactLegacySource = isMark
      ? (application.status === "SUBMITTED" || application.status === "REVIEWING") &&
        application.recruiterInterest === "REVIEW"
      : application.status === "REVIEWING" &&
        application.recruiterInterest === "MAYBE";
    if (!isExactLegacySource) {
      throw new InvalidApplicationTransitionError(
        `${command.intent} legacy requiere una proyección de revisión compatible`,
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
      reviewingAt: application.reviewingAt,
      offerAt: application.offerAt,
      hiredAt: application.hiredAt,
      rejectedAt: application.rejectedAt,
      rejectionEmailSent: application.rejectionEmailSent,
    },
    data: {
      ...projection,
      ...(command.intent === "START_REVIEW" ? { reviewingAt: happenedAt } : {}),
      ...(command.intent === "MARK_PRESELECTED"
        ? { reviewingAt: application.reviewingAt ?? happenedAt }
        : {}),
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
      ...(command.intent === "REOPEN_REJECTED"
        ? {
            rejectedAt: null,
            rejectionEmailSent: false,
            reviewingAt: application.reviewingAt ?? happenedAt,
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
