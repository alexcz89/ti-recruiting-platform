import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";

import type {
  ApplicationTransitionStore,
  StoredApplicationEvent,
  TransitionApplicationRecord,
  TransitionTransaction,
} from "./transition-application";

function toStoredEvent(event: {
  id: string;
  applicationId: string;
  companyId: string;
  actorType: StoredApplicationEvent["actorType"];
  actorId: string | null;
  type: StoredApplicationEvent["type"];
  fromStage: StoredApplicationEvent["fromStage"];
  toStage: StoredApplicationEvent["toStage"];
  fromDisposition: StoredApplicationEvent["fromDisposition"];
  toDisposition: StoredApplicationEvent["toDisposition"];
  visibility: StoredApplicationEvent["visibility"];
  reasonCode: string | null;
  metadata: unknown;
  happenedAt: Date;
  recordedAt: Date;
  idempotencyKey: string | null;
}): StoredApplicationEvent {
  return event;
}

function createTransactionAdapter(tx: Prisma.TransactionClient): TransitionTransaction {
  return {
    async findApplication(applicationId) {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          stage: true,
          disposition: true,
          stateVersion: true,
          status: true,
          recruiterInterest: true,
          reviewingAt: true,
          interviewAt: true,
          offerAt: true,
          hiredAt: true,
          rejectedAt: true,
          rejectionEmailSent: true,
          job: { select: { companyId: true } },
        },
      });
      if (!application) return null;
      return {
        ...application,
        companyId: application.job.companyId,
      } satisfies TransitionApplicationRecord;
    },

    async findEventByIdempotencyKey(companyId, applicationId, idempotencyKey) {
      const event = await tx.applicationEvent.findFirst({
        where: { companyId, applicationId, idempotencyKey },
      });
      return event ? toStoredEvent(event) : null;
    },

    async isActorAuthorized(actor, companyId) {
      if (actor.type === "SYSTEM" || actor.type === "IMPORT") return true;
      if (!actor.id) return false;

      if (actor.type === "ADMIN") {
        const admin = await tx.user.findFirst({
          where: {
            id: actor.id,
            role: "ADMIN",
            isActive: true,
            isSuspended: false,
            deletedAt: null,
          },
          select: { id: true },
        });
        return Boolean(admin);
      }

      if (actor.type !== "RECRUITER" || actor.companyId !== companyId) {
        return false;
      }

      const recruiter = await tx.user.findFirst({
        where: {
          id: actor.id,
          role: "RECRUITER",
          isActive: true,
          isSuspended: false,
          deletedAt: null,
          recruiterProfile: {
            is: { companyId, status: "APPROVED" },
          },
        },
        select: { id: true },
      });
      return Boolean(recruiter);
    },

    async updateApplicationIfVersion({
      applicationId,
      expectedVersion,
      changes,
    }) {
      const result = await tx.application.updateMany({
        where: { id: applicationId, stateVersion: expectedVersion },
        data: changes,
      });
      return result.count === 1;
    },

    async createEvent(event) {
      const created = await tx.applicationEvent.create({
        data: {
          ...event,
          metadata: event.metadata as Prisma.InputJsonValue,
        },
      });
      return toStoredEvent(created);
    },
  };
}

export const prismaApplicationTransitionStore: ApplicationTransitionStore = {
  transaction(work) {
    return prisma.$transaction(
      (tx) => work(createTransactionAdapter(tx)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
