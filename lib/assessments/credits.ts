import { prisma } from "@/lib/server/prisma";
import type { AssessmentType, AssessmentDifficulty, Prisma } from "@prisma/client";
import { lockAssessmentInviteTx } from "./mutation-locks";
import { isFinalAttemptStatus } from "./expiration";
import {
  getAssessmentCost,
  getCurrentBillingCycle,
  type AssessmentPricing,
} from "./pricing";

/**
 * Verificar si una empresa tiene suficientes créditos disponibles
 */
export async function hasAvailableCredits(
  companyId: string,
  requiredCredits: number = 0.5
): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      assessmentCredits: true,
      assessmentCreditsReserved: true,
    },
  });

  if (!company) return false;

  const available = Number(company.assessmentCredits);
  const reserved = Number(company.assessmentCreditsReserved);
  const effectiveBalance = available - reserved;

  return effectiveBalance >= requiredCredits;
}

/**
 * Reservar créditos al enviar una invitación de evaluación
 *
 * Flujo:
 * 1. Verifica que haya créditos disponibles
 * 2. Incrementa assessmentCreditsReserved
 * 3. Crea registro en AssessmentInviteChargeLedger con status RESERVED
 *
 * @returns true si se reservó exitosamente, false si no hay créditos
 */
export async function reserveCredits(
  companyId: string,
  inviteId: string,
  assessmentType: AssessmentType,
  difficulty: AssessmentDifficulty
): Promise<{ success: boolean; message?: string }> {
  const pricing = getAssessmentCost(assessmentType, difficulty);

  // Verificar disponibilidad
  const hasCredits = await hasAvailableCredits(companyId, pricing.reserve);

  if (!hasCredits) {
    return {
      success: false,
      message: "No hay suficientes créditos disponibles",
    };
  }

  try {
    await prisma.$transaction(async tx => {
      await lockAssessmentInviteTx(tx, inviteId);
      const invite = await tx.assessmentInvite.findUnique({ where: { id: inviteId }, select: { status: true } });
      if (!invite || invite.status === "CANCELLED" || isFinalAttemptStatus(invite.status)) throw new Error("INVITE_NOT_RESERVABLE");
      // 1. Reservar créditos
      await tx.company.update({
        where: { id: companyId },
        data: {
          assessmentCreditsReserved: {
            increment: pricing.reserve,
          },
        },
      });

      // 2. Crear registro en ledger
      await tx.assessmentInviteChargeLedger.create({
        data: {
          inviteId,
          companyId,
          kind: "ASSESSMENT_INVITE",
          cycle: getCurrentBillingCycle(),
          amount: pricing.reserve,
          status: "RESERVED",
          reservedAmount: pricing.reserve,
          assessmentType,
          difficulty,
          meta: JSON.parse(
            JSON.stringify({
              pricing,
              reservedAt: new Date().toISOString(),
              type: "RESERVE",
            })
          ),
        },
      });
    }, { isolationLevel: "ReadCommitted" });

    return { success: true };
  } catch (error) {
    console.error("[CREDITS] Failed to reserve credits:", error);
    return {
      success: false,
      message: "Error al reservar créditos",
    };
  }
}

/**
 * Cobrar créditos adicionales cuando un candidato completa la evaluación
 *
 * Flujo:
 * 1. Busca el registro RESERVED en el ledger
 * 2. Libera la reserva
 * 3. Cobra el total de créditos (reserva + adicional)
 * 4. Actualiza el ledger a status CHARGED
 */
export async function chargeCompletionCredits(
  inviteId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    return await prisma.$transaction(async tx => {
      await lockAssessmentInviteTx(tx, inviteId);
      // Buscar el registro de reserva
      const ledger = await tx.assessmentInviteChargeLedger.findFirst({
        where: {
          inviteId,
          status: "RESERVED",
        },
        include: {
          invite: {
            include: {
              template: {
                select: {
                  type: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      });

      if (!ledger || !ledger.assessmentType || !ledger.difficulty || ledger.invite.status === "CANCELLED") {
        return {
          success: false,
          message: "No se encontró la reserva de créditos",
        };
      }

      const pricing = getAssessmentCost(
        ledger.assessmentType,
        ledger.difficulty
      );

      // 1. Liberar reserva y cobrar total
      await tx.company.update({
        where: { id: ledger.companyId },
        data: {
          assessmentCreditsReserved: {
            decrement: pricing.reserve,
          },
          assessmentCredits: {
            decrement: pricing.total,
          },
          assessmentCreditsUsed: {
            increment: pricing.total,
          },
        },
      });

      // 2. Actualizar ledger a CHARGED
      await tx.assessmentInviteChargeLedger.update({
        where: { id: ledger.id },
        data: {
          status: "CHARGED",
          chargedAmount: pricing.total,
          amount: pricing.total,
          meta: JSON.parse(
            JSON.stringify({
              ...(ledger.meta as object),
              chargedAt: new Date().toISOString(),
              completionCharge: pricing.complete,
              type: "CHARGE",
            })
          ),
        },
      });
      return { success: true };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    console.error("[CREDITS] Failed to charge completion:", error);
    return {
      success: false,
      message: "Error al cobrar créditos de completación",
    };
  }
}

/**
 * Reembolsar créditos cuando una evaluación no se completa
 *
 * Usado por:
 * - Cron job diario para invites no completadas en 7 días
 * - Cancelación manual de invitación
 */
async function refundReservedCreditsTx(tx: Prisma.TransactionClient, inviteId: string, reason: string) {
  const ledger = await tx.assessmentInviteChargeLedger.findFirst({
    where: {
      inviteId,
      kind: "ASSESSMENT_INVITE",
      status: "RESERVED",
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      reservedAmount: true,
      meta: true,
      kind: true,
      cycle: true,
    },
  });

  if (!ledger || !ledger.reservedAmount) {
    return {
      success: false,
      message: "No se encontró la reserva de créditos",
    };
  }

  const updated = await tx.assessmentInviteChargeLedger.updateMany({
    where: {
      inviteId,
      kind: "ASSESSMENT_INVITE",
      cycle: ledger.cycle,
      status: "RESERVED",
    },
    data: {
      status: "REFUNDED",
      refundedAmount: ledger.reservedAmount,
      amount: 0,
      meta: JSON.parse(
        JSON.stringify({
          ...(ledger.meta as object),
          refundedAt: new Date().toISOString(),
          reason,
          type: "REFUND",
        })
      ),
    },
  });

  if (updated.count === 0) {
    return {
      success: false,
      message: "No se pudo reembolsar; el ledger ya cambió de estado",
    };
  }

  await tx.company.update({
    where: { id: ledger.companyId },
    data: {
      assessmentCreditsReserved: {
        decrement: Number(ledger.reservedAmount),
      },
    },
  });

  return { success: true };
}

// Cancellation deliberately does not lock attempts: all active writers hold
// this invite lock before changing evidence, state or its ledger.
async function refundableInviteTx(tx: Prisma.TransactionClient, inviteId: string) {
  await lockAssessmentInviteTx(tx, inviteId);
  const invite = await tx.assessmentInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, status: true, applicationId: true, candidateId: true, templateId: true, updatedAt: true },
  });
  if (!invite || isFinalAttemptStatus(invite.status)) return null;
  const completed = await tx.assessmentAttempt.findFirst({
    where: {
      status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] },
      OR: [
        { inviteId },
        { inviteId: null, applicationId: invite.applicationId, candidateId: invite.candidateId,
          templateId: invite.templateId, createdAt: { gte: invite.updatedAt } },
      ],
    },
    select: { id: true },
  });
  return completed ? null : invite;
}

export async function refundReservedCredits(
  inviteId: string,
  reason: string = "No completada en 7 días"
): Promise<{ success: boolean; message?: string }> {
  try {
    return await prisma.$transaction(async tx => {
      const invite = await refundableInviteTx(tx, inviteId);
      if (!invite) return { success: false, message: "La invitación no admite reembolso" };
      // An expired IN_PROGRESS attempt can still submit evidence saved in time.
      // Keep its reservation, including legacy attempts protected by the same
      // effective-invite tuple as mutation-locks. Do not lock attempts here.
      const pendingAttempt = await tx.assessmentAttempt.findFirst({
        where: {
          status: "IN_PROGRESS",
          OR: [
            { inviteId },
            { inviteId: null, applicationId: invite.applicationId,
              candidateId: invite.candidateId, templateId: invite.templateId },
          ],
        },
        select: { id: true },
      });
      if (pendingAttempt) return { success: false, message: "El intento iniciado conserva su reserva hasta finalizar" };
      const refund = await refundReservedCreditsTx(tx, inviteId, reason);
      if (!refund.success) return refund;
      // Refunding an unused invitation permanently closes this access cycle;
      // a later start must not consume the already released reservation.
      await tx.assessmentInvite.update({
        where: { id: inviteId }, data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return { success: true };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    console.error("[CREDITS] Failed to refund credits:", error);
    return { success: false, message: "Error al reembolsar créditos" };
  }
}

/** Refund and cancellation are one atomic operation; completed invites cannot be cancelled/refunded. */
export async function cancelInviteAndRefund(inviteId: string): Promise<{ success: boolean; message?: string }> {
  try {
    return await prisma.$transaction(async tx => {
      const invite = await refundableInviteTx(tx, inviteId);
      if (!invite) return { success: false, message: "La invitación no admite cancelación" };
      if (invite.status === "CANCELLED") return { success: true };
      const refund = await refundReservedCreditsTx(tx, inviteId, "Cancelada por el reclutador");
      if (!refund.success) return refund;
      await tx.assessmentInvite.update({
        where: { id: inviteId }, data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return { success: true };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    console.error("[CREDITS] Failed to cancel invite:", error);
    return { success: false, message: "Error al cancelar la invitación" };
  }
}

/**
 * Agregar créditos a una empresa (compra o recarga)
 */
export async function addCredits(
  companyId: string,
  amount: number,
  reason: string = "Compra de créditos"
): Promise<{ success: boolean; message?: string }> {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        assessmentCredits: {
          increment: amount,
        },
      },
    });

    // TODO: Registrar en un log de transacciones de créditos
    console.log(`[CREDITS] Added ${amount} credits to company ${companyId}: ${reason}`);

    return { success: true };
  } catch (error) {
    console.error("[CREDITS] Failed to add credits:", error);
    return {
      success: false,
      message: "Error al agregar créditos",
    };
  }
}

/**
 * Obtener balance de créditos de una empresa
 */
export async function getCreditBalance(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      assessmentCredits: true,
      assessmentCreditsUsed: true,
      assessmentCreditsReserved: true,
      assessmentPlan: true,
      assessmentPlanCreditsPerMonth: true,
    },
  });

  if (!company) return null;

  return {
    available: Number(company.assessmentCredits),
    reserved: Number(company.assessmentCreditsReserved),
    used: Number(company.assessmentCreditsUsed),
    effectiveBalance:
      Number(company.assessmentCredits) - Number(company.assessmentCreditsReserved),
    plan: company.assessmentPlan,
    planCreditsPerMonth: company.assessmentPlanCreditsPerMonth,
  };
}

/**
 * Obtener historial de uso de créditos
 */
export async function getCreditHistory(
  companyId: string,
  limit: number = 50
) {
  return await prisma.assessmentInviteChargeLedger.findMany({
    where: { companyId },
    include: {
      invite: {
        include: {
          candidate: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          job: {
            select: {
              title: true,
            },
          },
          template: {
            select: {
              title: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
