// app/dashboard/applications/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { ApplicationStatus } from "@prisma/client"; // ✅ IMPORTANTE
import { getSessionCompanyId } from "@/lib/server/session";
import { applicationWhereForActor } from "@/lib/server/candidate-access";

export async function updateApplicationStatusAction(
  appId: string,
  newStatus: ApplicationStatus // ✔️ Tipado fuerte
) {
  const s = await getServerSession(authOptions);
  if (!s?.user) return { error: "No autenticado" };

  const role = String(s.user.role ?? "").toUpperCase();
  if (role !== "RECRUITER" && role !== "ADMIN") {
    return { error: "No autorizado" };
  }

  const companyId = role === "RECRUITER"
    ? await getSessionCompanyId().catch(() => null)
    : null;
  const scopedWhere = applicationWhereForActor(
    { role, companyId },
    { applicationId: appId }
  );
  if (!scopedWhere) return { error: "No autorizado" };

  const application = await prisma.application.findFirst({
    where: scopedWhere,
    select: { id: true },
  });
  if (!application) return { error: "Solicitud no encontrada" };

  const isRejected = newStatus === ApplicationStatus.REJECTED;

  await prisma.application.update({
    where: { id: application.id },
    data: isRejected
      ? {
          status: ApplicationStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionEmailSent: false,
        }
      : {
          status: newStatus,
          rejectedAt: null,
          rejectionEmailSent: false,
        },
  });

  return { ok: true };
}
