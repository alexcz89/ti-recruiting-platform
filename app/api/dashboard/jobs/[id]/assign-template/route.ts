// app/api/dashboard/jobs/[id]/assign-template/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { getSessionCompanyId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// POST /api/dashboard/jobs/[id]/assign-template
// Body: { templateId: string, isRequired?: boolean, minScore?: number }
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json(403, { error: "Sin permisos" });
    }

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && role !== "ADMIN") {
      return json(403, { error: "Sin empresa asociada" });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const templateId = body?.templateId ? String(body.templateId) : null;
    const isRequired = body?.isRequired !== false; // default true
    const minScore =
      typeof body?.minScore === "number" && body.minScore >= 0 && body.minScore <= 100
        ? body.minScore
        : null;

    if (!templateId) {
      return json(400, { error: "templateId es requerido" });
    }

    // Verificar que la vacante pertenece a la empresa
    const job = await prisma.job.findFirst({
      where: {
        id: params.id,
        ...(role === "ADMIN" ? {} : { companyId: companyId! }),
      },
      select: { id: true, title: true, companyId: true },
    });

    if (!job) return json(404, { error: "Vacante no encontrada" });

    // Verificar que el template existe
    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, title: true, isActive: true },
    });

    if (!template) return json(404, { error: "Template no encontrado" });
    if (!template.isActive) return json(400, { error: "Template inactivo" });

    // Verificar si ya está asignado
    const existing = await prisma.jobAssessment.findUnique({
      where: { jobId_templateId: { jobId: job.id, templateId } },
    });

    if (existing) {
      // Actualizar si ya existe
      const updated = await prisma.jobAssessment.update({
        where: { jobId_templateId: { jobId: job.id, templateId } },
        data: {
          isRequired,
          ...(minScore !== null ? { minScore } : {}),
        },
        select: { id: true, isRequired: true, minScore: true },
      });

      return json(200, {
        ok: true,
        action: "updated",
        jobAssessment: updated,
        job: { id: job.id, title: job.title },
        template: { id: template.id, title: template.title },
      });
    }

    // Crear nueva asignación
    const jobAssessment = await prisma.jobAssessment.create({
      data: {
        job: { connect: { id: job.id } },
        template: { connect: { id: templateId } },
        isRequired,
        ...(minScore !== null ? { minScore } : {}),
      },
      select: { id: true, isRequired: true, minScore: true },
    });

    return json(200, {
      ok: true,
      action: "created",
      jobAssessment,
      job: { id: job.id, title: job.title },
      template: { id: template.id, title: template.title },
    });
  } catch (e: any) {
    console.error("[POST /api/dashboard/jobs/[id]/assign-template]", e);
    return json(500, { error: "Error interno" });
  }
}

// DELETE /api/dashboard/jobs/[id]/assign-template?templateId=xxx
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return json(401, { error: "No autorizado" });

    const role = String((session.user as any).role ?? "").toUpperCase();
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return json(403, { error: "Sin permisos" });
    }

    const companyId = await getSessionCompanyId().catch(() => null);
    if (!companyId && role !== "ADMIN") {
      return json(403, { error: "Sin empresa asociada" });
    }

    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId");
    if (!templateId) return json(400, { error: "templateId es requerido" });

    const job = await prisma.job.findFirst({
      where: {
        id: params.id,
        ...(role === "ADMIN" ? {} : { companyId: companyId! }),
      },
      select: { id: true },
    });

    if (!job) return json(404, { error: "Vacante no encontrada" });

    await prisma.jobAssessment.delete({
      where: { jobId_templateId: { jobId: job.id, templateId } },
    });

    return json(200, { ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") return json(404, { error: "Asignación no encontrada" });
    console.error("[DELETE /api/dashboard/jobs/[id]/assign-template]", e);
    return json(500, { error: "Error interno" });
  }
}