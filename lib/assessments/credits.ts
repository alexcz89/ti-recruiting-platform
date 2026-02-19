// lib/assessments/credits.ts
import { prisma } from "@/lib/server/prisma";
import type { AssessmentType, AssessmentDifficulty } from "@prisma/client";
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
    await prisma.$transaction([
      // 1. Reservar créditos
      prisma.company.update({
        where: { id: companyId },
        data: {
          assessmentCreditsReserved: {
            increment: pricing.reserve,
          },
        },
      }),

      // 2. Crear registro en ledger
      prisma.assessmentInviteChargeLedger.create({
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
          meta: JSON.parse(JSON.stringify({
            pricing,
            reservedAt: new Date().toISOString(),
            type: "RESERVE",
          })),
        },
      }),
    ]);

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
  // Buscar el registro de reserva
  const ledger = await prisma.assessmentInviteChargeLedger.findFirst({
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

  if (!ledger || !ledger.assessmentType || !ledger.difficulty) {
    return {
      success: false,
      message: "No se encontró la reserva de créditos",
    };
  }

  const pricing = getAssessmentCost(
    ledger.assessmentType,
    ledger.difficulty
  );

  try {
    await prisma.$transaction([
      // 1. Liberar reserva y cobrar total
      prisma.company.update({
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
      }),

      // 2. Actualizar ledger a CHARGED
      prisma.assessmentInviteChargeLedger.update({
        where: { id: ledger.id },
        data: {
          status: "CHARGED",
          chargedAmount: pricing.total,
          amount: pricing.total,
          meta: JSON.parse(JSON.stringify({
            ...(ledger.meta as object),
            chargedAt: new Date().toISOString(),
            completionCharge: pricing.complete,
            type: "CHARGE",
          })),
        },
      }),
    ]);

    return { success: true };
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
export async function refundReservedCredits(
  inviteId: string,
  reason: string = "No completada en 7 días"
): Promise<{ success: boolean; message?: string }> {
  const ledger = await prisma.assessmentInviteChargeLedger.findFirst({
    where: {
      inviteId,
      status: "RESERVED",
    },
  });

  if (!ledger || !ledger.reservedAmount) {
    return {
      success: false,
      message: "No se encontró la reserva de créditos",
    };
  }

  try {
    await prisma.$transaction([
      // 1. Liberar reserva (reembolsar)
      prisma.company.update({
        where: { id: ledger.companyId },
        data: {
          assessmentCreditsReserved: {
            decrement: ledger.reservedAmount,
          },
        },
      }),

      // 2. Actualizar ledger a REFUNDED
      prisma.assessmentInviteChargeLedger.update({
        where: { id: ledger.id },
        data: {
          status: "REFUNDED",
          refundedAmount: ledger.reservedAmount,
          amount: 0,
          meta: JSON.parse(JSON.stringify({
            ...(ledger.meta as object),
            refundedAt: new Date().toISOString(),
            reason,
            type: "REFUND",
          })),
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("[CREDITS] Failed to refund credits:", error);
    return {
      success: false,
      message: "Error al reembolsar créditos",
    };
  }
}

/**
 * Cancelar una invitación y reembolsar créditos
 * 
 * Usado cuando el reclutador cancela manualmente una invitación
 */
export async function cancelInviteAndRefund(
  inviteId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // 1. Reembolsar créditos
    const refundResult = await refundReservedCredits(
      inviteId,
      "Cancelada por el reclutador"
    );

    if (!refundResult.success) {
      return refundResult;
    }

    // 2. Actualizar estado de la invitación
    await prisma.assessmentInvite.update({
      where: { id: inviteId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[CREDITS] Failed to cancel invite:", error);
    return {
      success: false,
      message: "Error al cancelar la invitación",
    };
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
    effectiveBalance: Number(company.assessmentCredits) - Number(company.assessmentCreditsReserved),
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
              type: true,
              difficulty: true,
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