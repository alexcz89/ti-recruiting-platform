// app/api/assessments/[templateId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id: params.templateId },
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
        sections: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { questions: true, codingChallenges: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
    }

    const user = session.user as any;

    const [attemptsUsed, lastAttempt] = await Promise.all([
      // ✅ SOLO intentos “consumidos”
      prisma.assessmentAttempt.count({
        where: {
          candidateId: user.id,
          templateId: params.templateId,
          status: { in: ["SUBMITTED", "EVALUATED"] },
        },
      }),
      // ✅ último intento de cualquier status (para UX)
      prisma.assessmentAttempt.findFirst({
        where: { candidateId: user.id, templateId: params.templateId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          attemptNumber: true,
          createdAt: true,
          startedAt: true,
          submittedAt: true,
          totalScore: true,
          passed: true,
        },
      }),
    ]);

    const canRetry = !!template.allowRetry;
    const maxAttempts = template.maxAttempts ?? 1;

    const canStart = canRetry ? attemptsUsed < maxAttempts : attemptsUsed === 0;

    return NextResponse.json(
      {
        template,
        userStatus: {
          attemptsUsed,
          maxAttempts,
          canStart,
          lastAttempt: lastAttempt || null,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json({ error: "Error al cargar template" }, { status: 500 });
  }
}
