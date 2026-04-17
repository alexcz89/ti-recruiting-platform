// app/api/jobs/[id]/assessments/[assessmentId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyIdOrThrow } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function requireRecruiterOrAdmin(user: any) {
  const role = user?.role;
  return role === "RECRUITER" || role === "ADMIN";
}

// DELETE /api/jobs/[id]/assessments/[assessmentId]
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; assessmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const isAdmin = user?.role === "ADMIN";

    if (!requireRecruiterOrAdmin(user)) {
      return noStoreJson({ error: "No autorizado" }, 403);
    }

    if (isAdmin) {
      const deleted = await prisma.jobAssessment.deleteMany({
        where: {
          id: params.assessmentId,
          jobId: params.id,
        },
      });

      if (deleted.count === 0) {
        return noStoreJson(
          { error: "No se encontró la asignación (o no pertenece a esta vacante)" },
          404
        );
      }

      return noStoreJson({ success: true }, 200);
    }

    const companyId = await getSessionCompanyIdOrThrow();

    const job = await prisma.job.findFirst({
      where: {
        id: params.id,
        companyId,
      },
      select: { id: true },
    });

    if (!job) {
      return noStoreJson({ error: "Vacante no encontrada o no autorizada" }, 404);
    }

    const deleted = await prisma.jobAssessment.deleteMany({
      where: {
        id: params.assessmentId,
        jobId: job.id,
      },
    });

    if (deleted.count === 0) {
      return noStoreJson(
        { error: "No se encontró la asignación (o no pertenece a esta vacante)" },
        404
      );
    }

    return noStoreJson({ success: true }, 200);
  } catch (error) {
    console.error("Error removing assessment:", error);
    return noStoreJson({ error: "Error al remover assessment" }, 500);
  }
}