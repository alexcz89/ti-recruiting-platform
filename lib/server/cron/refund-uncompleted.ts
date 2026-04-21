// lib/server/cron/refund-uncompleted.ts
import { prisma } from "@/lib/server/prisma";
import { refundReservedCredits } from "@/lib/assessments/credits";

type RefundSummary = {
  refunded: number;
  failed: number;
  totalAmount: number;
};

const REFUND_AFTER_DAYS = 7;
const NON_COMPLETED_INVITE_STATUSES = ["SENT", "STARTED"] as const;

/**
 * Reembolsa créditos reservados de invites no completados
 * después de REFUND_AFTER_DAYS días.
 *
 * Requiere que refundReservedCredits(inviteId, reason) sea idempotente
 * y haga la transición RESERVED -> REFUNDED dentro de transacción.
 */
export async function refundUncompletedInvites(): Promise<RefundSummary> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REFUND_AFTER_DAYS);

  console.log(
    `[CRON] Checking uncompleted assessment invites before ${cutoff.toISOString()}`
  );

  const uncompletedLedgers = await prisma.assessmentInviteChargeLedger.findMany({
    where: {
      kind: "ASSESSMENT_INVITE",
      cycle: 1,
      status: "RESERVED",
      createdAt: {
        lt: cutoff,
      },
      invite: {
        status: {
          in: [...NON_COMPLETED_INVITE_STATUSES],
        },
      },
    },
    select: {
      id: true,
      inviteId: true,
      reservedAmount: true,
      createdAt: true,
      invite: {
        select: {
          id: true,
          status: true,
          candidateId: true,
          candidate: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          job: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log(
    `[CRON] Found ${uncompletedLedgers.length} reserved ledgers eligible for refund`
  );

  let refunded = 0;
  let failed = 0;
  let totalAmount = 0;

  for (const ledger of uncompletedLedgers) {
    try {
      const inviteStatus = String(ledger.invite.status ?? "").toUpperCase();

      if (!NON_COMPLETED_INVITE_STATUSES.includes(inviteStatus as (typeof NON_COMPLETED_INVITE_STATUSES)[number])) {
        console.warn(
          `[CRON] Skipping invite ${ledger.inviteId}: unexpected invite status ${inviteStatus}`
        );
        continue;
      }

      const result = await refundReservedCredits(
        ledger.inviteId,
        `Auto-refund: invite no completado en ${REFUND_AFTER_DAYS} días (reservado el ${ledger.createdAt.toISOString()})`
      );

      if (result.success) {
        refunded++;
        totalAmount += Number(ledger.reservedAmount ?? 0);

        console.log(
          `[CRON] Refunded ${Number(ledger.reservedAmount ?? 0)} credits for invite ${ledger.inviteId} ` +
            `(candidate: ${ledger.invite.candidate.email}, status: ${inviteStatus})`
        );
      } else {
        failed++;
        console.error(
          `[CRON] Failed to refund invite ${ledger.inviteId}: ${result.message}`
        );
      }
    } catch (error) {
      failed++;
      console.error(`[CRON] Error refunding ledger ${ledger.id}:`, error);
    }
  }

  const summary: RefundSummary = {
    refunded,
    failed,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };

  console.log(
    `[CRON] Refund job completed: ${summary.refunded} refunded, ${summary.failed} failed, ` +
      `${summary.totalAmount} total credits returned`
  );

  return summary;
}

/**
 * Enviar recordatorio a candidatos con invites pendientes
 * antes del refund automático.
 */
export async function sendReminderForPendingInvites(): Promise<number> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  const pendingInvites = await prisma.assessmentInvite.findMany({
    where: {
      status: "SENT",
      sentAt: {
        gte: sixDaysAgo,
        lt: fiveDaysAgo,
      },
    },
    include: {
      candidate: {
        select: {
          email: true,
          firstName: true,
        },
      },
      job: {
        select: {
          title: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      },
      template: {
        select: {
          title: true,
        },
      },
    },
  });

  console.log(`[CRON] Sending reminders to ${pendingInvites.length} candidates`);

  // TODO: Implementar envío de emails
  // for (const invite of pendingInvites) {
  //   await sendAssessmentReminderEmail(invite);
  // }

  return pendingInvites.length;
}