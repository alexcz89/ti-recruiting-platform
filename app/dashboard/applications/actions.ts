// app/dashboard/applications/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApplicationStatus } from "@prisma/client"; // ✅ IMPORTANTE

export async function updateApplicationStatusAction(
  appId: string,
  newStatus: ApplicationStatus // ✔️ Tipado fuerte
) {
  const s = await getServerSession(authOptions);
  if (!s?.user) return { error: "No autenticado" };

  const isRejected = newStatus === ApplicationStatus.REJECTED;

  await prisma.application.update({
    where: { id: appId },
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
