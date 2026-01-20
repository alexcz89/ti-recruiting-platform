// app/dashboard/overview/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

export async function updateApplicationStatus(
  applicationId: string,
  status: "REVIEWING" | "REJECTED"
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const user = session.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return { success: false, error: "Sin empresa asociada" };
    }

    // Verificar que la aplicación pertenezca a una vacante de la empresa
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { select: { companyId: true } } },
    });

    if (!application) {
      return { success: false, error: "Aplicación no encontrada" };
    }

    if (application.job.companyId !== companyId) {
      return { success: false, error: "No autorizado" };
    }

    // Actualizar status
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        recruiterInterest: status === "REVIEWING" ? "ACCEPTED" : "REJECTED",
        ...(status === "REJECTED" && {
          rejectedAt: new Date(),
        }),
      },
    });

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/jobs");

    return { success: true };
  } catch (error) {
    console.error("Error updating application:", error);
    return { success: false, error: "Error al actualizar" };
  }
}