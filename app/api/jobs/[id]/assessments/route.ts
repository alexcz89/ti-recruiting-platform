// app/api/jobs/[id]/assessments/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

// POST /api/jobs/[id]/assessments - Asignar assessment a vacante (✅ protegido multiempresa + rol)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return noStoreJson({ error: "No autorizado" }, 401);
    }

    const user = session.user as any;

    if (!requireRecruiterOrAdmin(user)) {
      return noStoreJson({ error: "No autorizado" }, 403);
    }

    const body = await request.json().catch(() => null);
    const templateId = String(body?.templateId || "");
    const isRequired = body?.isRequired ?? true;

    let minScore: number | null = null;
    if (typeof body?.minScore === "number" && Number.isFinite(body.minScore)) {
      // clamp 0..100
      minScore = Math.max(0, Math.min(100, Math.trunc(body.minScore)));
    }

    if (!templateId) {
      return noStoreJson({ error: "templateId es requerido" }, 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { companyId: true },
    });

    if (!job) {
      return noStoreJson({ error: "Vacante no encontrada" }, 404);
    }

    if (!user.companyId || job.companyId !== user.companyId) {
      return noStoreJson({ error: "No autorizado" }, 403);
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });

    if (!template) {
      return noStoreJson({ error: "Assessment no encontrado" }, 404);
    }

    // Evitar duplicados (por si no hay constraint único)
    const existing = await prisma.jobAssessment.findFirst({
      where: { jobId: params.id, templateId },
      select: { id: true },
    });

    if (existing) {
      return noStoreJson({ error: "Ese assessment ya está asignado a la vacante" }, 409);
    }

    const jobAssessment = await prisma.jobAssessment.create({
      data: {
        jobId: params.id,
        templateId,
        isRequired: Boolean(isRequired),
        minScore,
      },
      include: {
        template: true,
      },
    });

    return noStoreJson(jobAssessment, 200);
  } catch (error) {
    console.error("Error assigning assessment:", error);
    return noStoreJson({ error: "Error al asignar assessment" }, 500);
  }
}

// GET /api/jobs/[id]/assessments - Listar assessments de una vacante (✅ protegido multiempresa + rol + log)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.log("[GET /api/jobs/:id/assessments] 401", {
        id: params.id,
        referer: request.headers.get("referer"),
        origin: request.headers.get("origin"),
        ua: request.headers.get("user-agent"),
      });
      return noStoreJson({ error: "No autorizado" }, 401);
    }

    const user = session.user as any;

    if (!requireRecruiterOrAdmin(user)) {
      console.log("[GET /api/jobs/:id/assessments] 403(role)", {
        id: params.id,
        role: user?.role,
        referer: request.headers.get("referer"),
        origin: request.headers.get("origin"),
        ua: request.headers.get("user-agent"),
      });
      return noStoreJson({ error: "No autorizado" }, 403);
    }

    // ✅ Log para detectar quién lo consume
    console.log("[GET /api/jobs/:id/assessments]", {
      id: params.id,
      referer: request.headers.get("referer"),
      origin: request.headers.get("origin"),
      ua: request.headers.get("user-agent"),
    });

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { companyId: true },
    });

    if (!job) {
      return noStoreJson({ error: "Vacante no encontrada" }, 404);
    }

    if (!user.companyId || job.companyId !== user.companyId) {
      return noStoreJson({ error: "No autorizado" }, 403);
    }

    const assessments = await prisma.jobAssessment.findMany({
      where: { jobId: params.id },
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
      orderBy: { createdAt: "asc" },
    });

    return noStoreJson({ assessments }, 200);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return noStoreJson({ error: "Error al cargar assessments" }, 500);
  }
}
