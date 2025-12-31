// app/api/assessments/attempts/[attemptId]/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      include: {
        template: true,
        answers: { include: { question: true } },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    if (attempt.candidateId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ✅ Bloquear estados incorrectos
    if (attempt.status === "SUBMITTED" || attempt.status === "EVALUATED") {
      return NextResponse.json({ error: "El intento ya fue enviado" }, { status: 400 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "El intento no está en progreso" },
        { status: 400 }
      );
    }

    // ✅ Validar expiración (server-side)
    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return NextResponse.json({ error: "Tiempo expirado" }, { status: 400 });
    }

    if (!attempt.startedAt) {
      return NextResponse.json(
        { error: "El intento no ha sido iniciado correctamente" },
        { status: 400 }
      );
    }

    const answeredCount = attempt.answers.length;

    // totalPoints (asumiendo pointsEarned calculado server-side en /answer)
    const totalPoints = attempt.answers.reduce(
      (sum, a) => sum + (a.pointsEarned || 0),
      0
    );

    // totalQuestions del template es el denominador (si hoy todo vale 1)
    const maxPoints = attempt.template.totalQuestions || answeredCount || 0;
    const totalScore =
      maxPoints > 0 ? Math.max(0, Math.round((totalPoints / maxPoints) * 100)) : 0;

    // Scores por sección con guardas (evita /0)
    const sections = (attempt.template.sections as any[]) || [];
    const sectionScores: Record<string, number> = {};

    for (const section of sections) {
      const sectionAnswers = attempt.answers.filter(
        (a) => a.question.section === section.name
      );
      const sectionPoints = sectionAnswers.reduce(
        (sum, a) => sum + (a.pointsEarned || 0),
        0
      );

      const sectionMax = Number(section.questions || 0);

      sectionScores[section.name] =
        sectionMax > 0 ? Math.max(0, Math.round((sectionPoints / sectionMax) * 100)) : 0;
    }

    const timeSpent = attempt.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);

    // Flags (merge)
    const flags: any = { ...(attempt.flagsJson as any) };

    // Flag: respondió muy rápido (solo si hay respuestas)
    if (answeredCount > 0) {
      const avgTimePerQuestion = timeSpent / answeredCount;
      if (avgTimePerQuestion < 5) flags.tooFast = true;
    }

    const passed = totalScore >= attempt.template.passingScore;

    // ✅ Update atómico por estado (evita doble-submit por race condition)
    const updated = await prisma.assessmentAttempt.updateMany({
      where: {
        id: params.attemptId,
        candidateId: user.id,
        status: "IN_PROGRESS",
      },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        totalScore,
        sectionScores,
        passed,
        timeSpent,
        flagsJson: flags,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "No se pudo enviar (estado inválido o ya enviado)" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        totalScore,
        sectionScores,
        passed,
        passingScore: attempt.template.passingScore,
        timeSpent,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return NextResponse.json({ error: "Error al enviar evaluación" }, { status: 500 });
  }
}
