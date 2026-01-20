// app/api/assessments/attempts/[attemptId]/state/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

export const dynamic = "force-dynamic";

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function answeredLen(v: unknown) {
  return Array.isArray(v) ? v.length : 0;
}

// GET /api/assessments/attempts/[attemptId]/state
export async function GET(_request: Request, { params }: { params: { attemptId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const userId = String(user?.id || "");
    const role = String(user?.role ?? "").toUpperCase();

    if (!userId) return jsonNoStore({ error: "No autorizado" }, 401);
    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);

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

    if (!attempt) return jsonNoStore({ error: "Attempt no encontrado" }, 404);
    if (attempt.candidateId !== userId) return jsonNoStore({ error: "No autorizado" }, 403);

    // Traer respuestas guardadas (AttemptAnswer)
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
      answers[r.questionId] = Array.isArray(r.selectedOptions) ? (r.selectedOptions as any) : [];
      timeSpent[r.questionId] = typeof r.timeSpent === "number" ? r.timeSpent : 0;
    }

    const lastAnsweredQuestionId = rows.length ? rows[0].questionId : null;

    const meta = (attempt.flagsJson as any) || null;
    const order: string[] = Array.isArray(meta?.questionOrder) ? meta.questionOrder : [];

    const expired = Boolean(attempt.expiresAt && attempt.expiresAt <= now);

    const answeredCount = order.length
      ? order.reduce((acc, qid) => acc + (answeredLen(answers[qid]) > 0 ? 1 : 0), 0)
      : Object.values(answers).reduce((acc, arr) => acc + (answeredLen(arr) > 0 ? 1 : 0), 0);

    // ✅ currentIndex solo si hay questionOrder; si no, el frontend calcula firstUnansweredIndex()
    let currentIndex: number | undefined = undefined;

    if (order.length) {
      const firstUnanswered = order.findIndex((qid) => answeredLen(answers[qid]) === 0);

      if (firstUnanswered >= 0) currentIndex = firstUnanswered;
      else currentIndex = Math.max(0, order.length - 1);

      // clamp defensivo
      currentIndex = Math.max(0, Math.min(currentIndex, order.length - 1));
    }

    const payload: any = {
      attemptId: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      expired,
      answers,
      timeSpent,
      lastAnsweredQuestionId,
      answeredCount,
    };

    if (typeof currentIndex === "number") payload.currentIndex = currentIndex;

    return jsonNoStore(payload);
  } catch (error) {
    console.error("Error loading attempt state:", error);
    return jsonNoStore({ error: "Error al cargar estado del intento" }, 500);
  }
}
