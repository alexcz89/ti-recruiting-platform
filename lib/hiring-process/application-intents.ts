import "server-only";

import { z } from "zod";

import { applicationWhereForActor } from "@/lib/server/candidate-access";
import { prisma } from "@/lib/server/prisma";

import { isCanonicalHiringProcessEnabled } from "./feature-flags";
import {
  ApplicationNotFoundError,
  ConcurrentApplicationTransitionError,
  transitionApplication,
  UnauthorizedApplicationTransitionError,
  type TransitionActor,
} from "./transition-application";

export const APPLICATION_INTENTS = [
  "START_REVIEW",
  "MOVE_TO_INTERVIEW",
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
  }
}

function legacyProjectionForIntent(intent: ApplicationIntent) {
  switch (intent) {
    case "START_REVIEW":
      return { status: "REVIEWING" as const, recruiterInterest: "REVIEW" as const };
    case "MOVE_TO_INTERVIEW":
      return { status: "INTERVIEW" as const, recruiterInterest: "ACCEPTED" as const };
  }
}

export async function executeApplicationIntent(input: {
  applicationId: string;
  command: ApplicationIntentCommand;
  actor: TransitionActor;
}) {
  const { applicationId, command, actor } = input;

  if (isCanonicalHiringProcessEnabled()) {
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

  const application = await prisma.application.findFirst({
    where: scopedWhere,
    select: { id: true, stateVersion: true },
  });
  if (!application) throw new ApplicationNotFoundError();
  if (application.stateVersion !== command.expectedVersion) {
    throw new ConcurrentApplicationTransitionError();
  }

  // Temporary legacy exception: removed when the canonical flag becomes authoritative.
  const projection = legacyProjectionForIntent(command.intent);
  const updated = await prisma.application.updateMany({
    where: { id: application.id, stateVersion: command.expectedVersion },
    data: {
      ...projection,
      ...(command.intent === "START_REVIEW" ? { reviewingAt: new Date() } : {}),
      ...(command.intent === "MOVE_TO_INTERVIEW" ? { interviewAt: new Date() } : {}),
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
