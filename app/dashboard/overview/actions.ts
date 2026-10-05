// app/dashboard/overview/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from "@/lib/server/session";
import { applicationWhereForActor } from "@/lib/server/candidate-access";
import { isCanonicalHiringProcessEnabled } from "@/lib/hiring-process/feature-flags";
import { executeApplicationIntent } from "@/lib/hiring-process/application-intents";
import { transitionApplication } from "@/lib/hiring-process/transition-application";

export async function updateApplicationStatus(
  applicationId: string,
  status: "REVIEWING" | "REJECTED",
  command?: { expectedVersion: number; commandId: string },
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
      select: {
        id: true,
        stage: true,
        disposition: true,
        stateVersion: true,
      },
    });

    if (!application) {
      return { success: false, error: "Aplicación no encontrada" };
    }

    if (status === "REJECTED") {
      const actorId = session.user.id ? String(session.user.id) : null;
      if (
        !actorId ||
        !command ||
        !Number.isInteger(command.expectedVersion) ||
        command.expectedVersion < 0 ||
        !command.commandId.trim()
      ) {
        return { success: false, error: "Comando inválido" };
      }

      await executeApplicationIntent({
        applicationId: application.id,
        command: {
          intent: "REJECT_CANDIDATE",
          expectedVersion: command.expectedVersion,
          commandId: command.commandId,
        },
        actor: { type: role, id: actorId, companyId },
      });

      revalidatePath("/dashboard/overview");
      revalidatePath("/dashboard/jobs");
      return { success: true };
    }

    const canonicalPilotEnabled =
      status === "REVIEWING" && isCanonicalHiringProcessEnabled();

    if (canonicalPilotEnabled) {
      const actorId = session.user.id ? String(session.user.id) : null;
      if (!actorId) {
        return { success: false, error: "No autorizado" };
      }

      const isIdempotentReplay =
        application.stage === "REVIEW" &&
        application.disposition === "ACTIVE";
      const isApprovedPilotSource =
        application.stage === "APPLIED" &&
        application.disposition === "ACTIVE";
      if (!isApprovedPilotSource && !isIdempotentReplay) {
        return { success: false, error: "Error al actualizar" };
      }

      const sourceVersion = isIdempotentReplay
        ? application.stateVersion - 1
        : application.stateVersion;

      await transitionApplication({
        applicationId: application.id,
        targetStage: "REVIEW",
        targetDisposition: "ACTIVE",
        expectedVersion: sourceVersion,
        actor: {
          type: role,
          id: actorId,
          companyId,
        },
        idempotencyKey: `overview-review:${application.id}:v${sourceVersion}`,
      });
    } else {
      // Legacy behavior remains the authority while the pilot flag is off.
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status,
          recruiterInterest: "ACCEPTED",
        },
      });
    }

    revalidatePath("/dashboard/overview");
    revalidatePath("/dashboard/jobs");

    return { success: true };
  } catch (error) {
    console.error("Error updating application:", error);
    return { success: false, error: "Error al actualizar" };
  }
}
