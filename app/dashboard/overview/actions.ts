// app/dashboard/overview/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from "@/lib/server/session";
import { applicationWhereForActor } from "@/lib/server/candidate-access";

export async function updateApplicationStatus(
  applicationId: string,
  status: "REVIEWING" | "REJECTED"
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: "No autorizado" };
    }

    const role = String(session.user.role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return { success: false, error: "No autorizado" };
    }
    const companyId = role === "RECRUITER"
      ? await getSessionCompanyId().catch(() => null)
      : null;
    const scopedWhere = applicationWhereForActor(
      { role, companyId },
      { applicationId }
    );
    if (!scopedWhere) return { success: false, error: "Sin empresa asociada" };

    // Verificar que la aplicación pertenezca a una vacante de la empresa
    const application = await prisma.application.findFirst({
      where: scopedWhere,
      select: { id: true },
    });

    if (!application) {
      return { success: false, error: "Aplicación no encontrada" };
    }

    // Actualizar status
    await prisma.application.update({
      where: { id: application.id },
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
