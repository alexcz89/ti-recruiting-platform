// app/api/jobs/[id]/assessments/[assessmentId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionCompanyId } from "@/lib/session";

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

// DELETE /api/jobs/[id]/assessments/[assessmentId] - Remover assessment (✅ multiempresa + rol)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; assessmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const isAdmin = user?.role === "ADMIN";
    if (!requireRecruiterOrAdmin(user)) return noStoreJson({ error: "No autorizado" }, 403);

    const sessionCompanyId = await getSessionCompanyId().catch(() => null);
    if (!sessionCompanyId && !isAdmin) return noStoreJson({ error: "Sin empresa asociada" }, 403);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true },
    });

    if (!job) return noStoreJson({ error: "Vacante no encontrada" }, 404);

    if (!isAdmin) {
      if (!sessionCompanyId || job.companyId !== sessionCompanyId) {
        return noStoreJson({ error: "No autorizado" }, 403);
      }
    }

    // ✅ asegura que el assessmentId pertenece a ESTE job
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
  } catch (error) {
    console.error("Error removing assessment:", error);
    return noStoreJson({ error: "Error al remover assessment" }, 500);
  }
}
