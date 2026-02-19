// lib/server/cron/refund-uncompleted.ts
import { prisma } from "@/lib/server/prisma";
import { refundReservedCredits } from "@/lib/assessments/credits";

/**
 * Reembolsar créditos de evaluaciones no completadas después de 7 días
 * 
 * Ejecutar diariamente con cron job o Vercel Cron
 * 
 * Ejemplos de configuración:
 * 
 * 1. Vercel Cron (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/refund-uncompleted",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * 
 * 2. Node-cron:
 * import cron from 'node-cron';
 * cron.schedule('0 2 * * *', () => refundUncompletedInvites());
 */
export async function refundUncompletedInvites(): Promise<{
  refunded: number;
  failed: number;
  totalAmount: number;
}> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log(`[CRON] Checking for uncompleted invites before ${sevenDaysAgo.toISOString()}`);

  // Buscar invites con créditos reservados que no se han completado en 7 días
  const uncompletedLedgers = await prisma.assessmentInviteChargeLedger.findMany({
    where: {
      status: "RESERVED",
      createdAt: {
        lt: sevenDaysAgo,
      },
    },
    include: {
      invite: {
        select: {
          id: true,
          candidateId: true,
          status: true,
          candidate: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  console.log(`[CRON] Found ${uncompletedLedgers.length} uncompleted invites to refund`);

  let refunded = 0;
  let failed = 0;
  let totalAmount = 0;

  for (const ledger of uncompletedLedgers) {
    try {
      const result = await refundReservedCredits(
        ledger.inviteId,
        `Auto-refund: No completada en 7 días (invitada el ${ledger.createdAt.toLocaleDateString()})`
      );

      if (result.success) {
        refunded++;
        totalAmount += Number(ledger.reservedAmount || 0);
        
        console.log(
          `[CRON] ✓ Refunded ${ledger.reservedAmount} credits for invite ${ledger.inviteId} ` +
          `(candidate: ${ledger.invite.candidate.email})`
        );
      } else {
        failed++;
        console.error(
          `[CRON] ✗ Failed to refund invite ${ledger.inviteId}: ${result.message}`
        );
      }
    } catch (error) {
      failed++;
      console.error(`[CRON] ✗ Error refunding ledger ${ledger.id}:`, error);
    }
  }

  const summary = {
    refunded,
    failed,
    totalAmount: Math.round(totalAmount * 10) / 10, // Redondear a 1 decimal
  };

  console.log(
    `[CRON] Refund job completed: ${refunded} refunded, ${failed} failed, ` +
    `${summary.totalAmount} total credits returned`
  );

  return summary;
}

/**
 * Enviar recordatorio a candidatos con invites pendientes (antes de que expire)
 * 
 * Se puede ejecutar antes del refund automático para dar una última oportunidad
 */
export async function sendReminderForPendingInvites(): Promise<number> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  // Invites entre 5 y 6 días sin completar
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