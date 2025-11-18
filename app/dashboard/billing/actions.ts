"use server";

import { prisma } from "@/lib/prisma";
import { getSessionCompanyId } from "@/lib/session";
import { PLANS, type PlanId } from "@/config/plans";

export async function changePlan(planId: PlanId) {
  const companyId = await getSessionCompanyId();

  if (!companyId) {
    throw new Error("No hay sesión activa.");
  }

  // Validar que el plan exista en la configuración
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    throw new Error("Plan inválido.");
  }

  // Aquí en el futuro podrías validar Stripe / pagos, etc.
  await prisma.company.update({
    where: { id: companyId },
    data: { billingPlan: planId },
  });

  // Devolvemos info básica por si la quieres usar en el cliente
  return {
    ok: true,
    planId,
  };
}
