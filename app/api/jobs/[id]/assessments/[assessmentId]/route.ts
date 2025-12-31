// app/api/jobs/[id]/assessments/[assessmentId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/jobs/[id]/assessments/[assessmentId] - Remover assessment
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; assessmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { companyId: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
    }

    if (!user.companyId || job.companyId !== user.companyId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ✅ asegura que el assessmentId pertenece a ESTE job
    const deleted = await prisma.jobAssessment.deleteMany({
      where: {
        id: params.assessmentId,
        jobId: params.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "No se encontró la asignación (o no pertenece a esta vacante)" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error removing assessment:", error);
    return NextResponse.json({ error: "Error al remover assessment" }, { status: 500 });
  }
}
