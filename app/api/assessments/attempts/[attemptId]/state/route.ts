// app/api/assessments/attempts/[attemptId]/state/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/assessments/attempts/[attemptId]/state
export async function GET(
  _request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = session.user as any;
    const now = new Date();

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      select: {
        id: true,
        candidateId: true,
        status: true,
        expiresAt: true,
        flagsJson: true,
        startedAt: true,
        submittedAt: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt no encontrado" }, { status: 404 });
    }

    if (attempt.candidateId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Traer respuestas guardadas (AttemptAnswer)
    // ✅ DESC para detectar rápido la “última contestada”
    const rows = await prisma.attemptAnswer.findMany({
      where: { attemptId: attempt.id },
      select: {
        questionId: true,
        selectedOptions: true,
        timeSpent: true,
        answeredAt: true,
      },
      orderBy: { answeredAt: "desc" },
    });

    const answers: Record<string, string[]> = {};
    const timeSpent: Record<string, number> = {};

    for (const r of rows) {
      answers[r.questionId] = Array.isArray(r.selectedOptions) ? r.selectedOptions : [];
      timeSpent[r.questionId] = typeof r.timeSpent === "number" ? r.timeSpent : 0;
    }

    const lastAnsweredQuestionId = rows.length ? rows[0].questionId : null;

    const meta = (attempt.flagsJson as any) || null;
    const order: string[] = Array.isArray(meta?.questionOrder) ? meta.questionOrder : [];

    let currentIndex = 0;

    if (lastAnsweredQuestionId && order.length) {
      const idx = order.indexOf(lastAnsweredQuestionId);
      if (idx >= 0) {
        // siguiente pregunta (si no es la última)
        currentIndex = Math.min(idx + 1, order.length - 1);
      }
    }

    // clamp defensivo
    if (order.length) {
      currentIndex = Math.max(0, Math.min(currentIndex, order.length - 1));
    } else {
      currentIndex = 0;
    }

    const expired = Boolean(attempt.expiresAt && attempt.expiresAt <= now);

    return NextResponse.json(
      {
        attemptId: attempt.id,
        status: attempt.status,
        expiresAt: attempt.expiresAt,
        expired,
        answers,
        timeSpent,
        lastAnsweredQuestionId,
        currentIndex,
        answeredCount: Object.keys(answers).length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error loading attempt state:", error);
    return NextResponse.json(
      { error: "Error al cargar estado del intento" },
      { status: 500 }
    );
  }
}
