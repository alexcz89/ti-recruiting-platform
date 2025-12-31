// app/api/assessments/attempts/[attemptId]/results/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
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
        application: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                companyId: true,
                recruiterId: true,
              },
            },
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                section: true,
                difficulty: true,
                questionText: true,
                codeSnippet: true,
                options: true,
                explanation: true,
              },
            },
          },
        },
        candidate: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    const isOwner = attempt.candidateId === user.id;
    const isAdmin = user.role === "ADMIN";
    const isRecruiter = user.role === "RECRUITER";

    let recruiterCanView = false;

    if (isRecruiter) {
      const recruiterCompanyId = user.companyId as string | undefined;
      const job = attempt.application?.job;

      // ✅ Si no está ligado a una vacante, recruiter NO lo ve
      if (job && recruiterCompanyId) {
        recruiterCanView =
          job.companyId === recruiterCompanyId ||
          (job.recruiterId ? job.recruiterId === user.id : false);
      }
    }

    if (!isOwner && !isAdmin && !recruiterCanView) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Solo resultados cuando ya fue enviada/evaluada
    if (attempt.status === "NOT_STARTED" || attempt.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "La evaluación aún no ha sido completada" },
        { status: 400 }
      );
    }

    const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    const answeredCount = attempt.answers.length;

    // ✅ evita NaN /0
    const totalQuestions = attempt.template.totalQuestions ?? answeredCount;
    const accuracy =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const result = {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeSpent: attempt.timeSpent,
        totalScore: attempt.totalScore,
        sectionScores: attempt.sectionScores,
        passed: attempt.passed,
        flagsJson: attempt.flagsJson,
      },
      template: {
        title: attempt.template.title,
        difficulty: attempt.template.difficulty,
        passingScore: attempt.template.passingScore,
        sections: attempt.template.sections,
      },
      candidate: isAdmin || recruiterCanView ? attempt.candidate : undefined,
      answers: attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        section: answer.question.section,
        difficulty: answer.question.difficulty,
        questionText: answer.question.questionText,
        codeSnippet: answer.question.codeSnippet,
        options: answer.question.options,
        selectedOptions: answer.selectedOptions,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        timeSpent: answer.timeSpent,
        explanation: answer.question.explanation,
      })),
      stats: {
        correctAnswers: correctCount,
        answeredQuestions: answeredCount,
        totalQuestions,
        accuracy,
      },
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json({ error: "Error al cargar resultados" }, { status: 500 });
  }
}
