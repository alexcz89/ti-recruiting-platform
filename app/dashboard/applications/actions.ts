// app/dashboard/applications/actions.ts (ejemplo)
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function updateApplicationStatusAction(appId: string, newStatus: string) {
  const s = await getServerSession(authOptions);
  if (!s?.user) return { error: "No autenticado" };

  // TODO: valida permisos de recruiter/admin sobre la app

  const isRejected = newStatus === "REJECTED";

  await prisma.application.update({
    where: { id: appId },
    data: isRejected
      ? {
          status: "REJECTED",
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
