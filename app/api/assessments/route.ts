// app/api/assessments/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
// ✅ NUEVO: Sistema de créditos
import { getAssessmentCost } from '@/lib/assessments/pricing';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// GET /api/assessments - Lista templates disponibles
export async function GET(_request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    // Si quieres limitar por rol, descomenta:
    // const role = String((session.user as any)?.role ?? "").toUpperCase();
    // if (!["RECRUITER", "ADMIN"].includes(role)) return jsonNoStore({ error: "Forbidden" }, 403);

    const templates = await prisma.assessmentTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        difficulty: true,
        timeLimit: true,
        passingScore: true,
        totalQuestions: true,
        allowRetry: true,
        maxAttempts: true,
        isActive: true,
        sections: true,
        penalizeWrong: true,
        shuffleQuestions: true,
        // ✅ NUEVO: Campos de créditos
        baseCreditCost: true,
        pricingConfig: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { 
            questions: true, 
            codingChallenges: true,
            // ✅ NUEVO: Stats de uso
            attempts: true,
            invites: true,
          },
        },
      },
    });

    // ✅ NUEVO: Agregar info de costos calculados a cada template
    const templatesWithCosts = templates.map((template) => {
      // Calcular costo real basado en tipo y dificultad
      const cost = getAssessmentCost(template.type, template.difficulty);
      
      return {
        ...template,
        // Convertir Decimal a number
        baseCreditCost: Number(template.baseCreditCost),
        // ✅ NUEVO: Info de costos
        pricing: {
          reserve: cost.reserve,
          complete: cost.complete,
          total: cost.total,
        },
        // ✅ NUEVO: Stats de uso
        usage: {
          totalQuestions: template._count.questions,
          totalCodingChallenges: template._count.codingChallenges,
          totalAttempts: template._count.attempts,
          totalInvites: template._count.invites,
        },
      };
    });

    return jsonNoStore({ templates: templatesWithCosts });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return jsonNoStore({ error: "Error al cargar templates" }, 500);
  }
}