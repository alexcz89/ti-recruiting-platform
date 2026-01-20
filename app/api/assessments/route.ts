// app/api/assessments/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

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
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { questions: true, codingChallenges: true },
        },
      },
    });

    return jsonNoStore({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return jsonNoStore({ error: "Error al cargar templates" }, 500);
  }
}
