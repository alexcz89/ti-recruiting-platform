// app/api/jobs/[id]/assessments/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { getSessionCompanyId } from '@/lib/server/session';

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

// POST /api/jobs/[id]/assessments - Asignar assessment a vacante (✅ multiempresa + rol)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return noStoreJson({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const isAdmin = user?.role === "ADMIN";
    if (!requireRecruiterOrAdmin(user)) return noStoreJson({ error: "No autorizado" }, 403);

    const sessionCompanyId = await getSessionCompanyId().catch(() => null);
    if (!sessionCompanyId && !isAdmin) return noStoreJson({ error: "Sin empresa asociada" }, 403);

    const body = await request.json().catch(() => ({}));

    const templateId = String(body?.templateId || "");
    const isRequired = body?.isRequired ?? true;

    let minScore: number | null = null;
    if (typeof body?.minScore === "number" && Number.isFinite(body.minScore)) {
      minScore = Math.max(0, Math.min(100, Math.trunc(body.minScore)));
    }

    if (!templateId) return noStoreJson({ error: "templateId es requerido" }, 400);

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true },
    });

    if (!job) return noStoreJson({ error: "Vacante no encontrada" }, 404);

    // ✅ Multiempresa: recruiter debe estar en el company del job (admin puede bypass)
    if (!isAdmin) {
      if (!sessionCompanyId || job.companyId !== sessionCompanyId) {
        return noStoreJson({ error: "No autorizado" }, 403);
      }
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, isActive: true },
    });

    if (!template) return noStoreJson({ error: "Assessment no encontrado" }, 404);
    if (!template.isActive) return noStoreJson({ error: "Assessment inactivo" }, 400);

    // ✅ Evitar duplicados (también existe @@unique([jobId, templateId]) en schema)
    const existing = await prisma.jobAssessment.findFirst({
      where: { jobId: params.id, templateId },
      select: { id: true },
    });

    if (existing) {
      return noStoreJson({ error: "Ese assessment ya está asignado a la vacante" }, 409);
    }

    try {
      const jobAssessment = await prisma.jobAssessment.create({
        data: {
          jobId: params.id,
          templateId,
          isRequired: Boolean(isRequired),
          minScore,
        },
        include: {
          template: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              totalQuestions: true,
              timeLimit: true,
              passingScore: true,
            },
          },
        },
      });

      return noStoreJson(jobAssessment, 200);
    } catch (e: any) {
      // Race condition: unique(jobId, templateId)
      if (String(e?.code || "") === "P2002") {
        return noStoreJson({ error: "Ese assessment ya está asignado a la vacante" }, 409);
      }
      throw e;
    }
  } catch (error) {
    console.error("Error assigning assessment:", error);
    return noStoreJson({ error: "Error al asignar assessment" }, 500);
  }
}

// GET /api/jobs/[id]/assessments - Listar assessments de una vacante (✅ multiempresa + rol)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
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

    // 🆕 Incluir todos los campos necesarios
    const jobAssessments = await prisma.jobAssessment.findMany({
      where: { jobId: params.id },
      include: {
        template: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            difficulty: true,
            totalQuestions: true,
            timeLimit: true,
            passingScore: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 🆕 Filtrar solo activos y aplanar estructura
    const assessments = jobAssessments
      .filter(ja => ja.template.isActive)
      .map(ja => ({
        ...ja.template,
        isRequired: ja.isRequired,
        minScore: ja.minScore,
      }));

    return noStoreJson({ assessments }, 200);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return noStoreJson({ error: "Error al cargar assessments" }, 500);
  }
}