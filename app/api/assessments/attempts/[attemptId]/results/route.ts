// app/api/assessments/attempts/[attemptId]/results/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { getSessionCompanyId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

type AttemptStatusLike =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "EVALUATED"
  | "COMPLETED"
  | string;

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isAttemptFinal(status: AttemptStatusLike) {
  const s = String(status ?? "").toUpperCase();
  return s === "SUBMITTED" || s === "EVALUATED" || s === "COMPLETED";
}

export async function GET(
  _request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as SessionUser;
    const role = String(user.role ?? "").toUpperCase();
    const userId = String(user.id ?? "");

    const attemptBase = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      select: {
        id: true,
        status: true,
        attemptNumber: true,
        candidateId: true,
        templateId: true,
        applicationId: true,
        inviteId: true,
        startedAt: true,
        submittedAt: true,
        expiresAt: true,
        timeSpent: true,
        totalScore: true,
        sectionScores: true,
        passed: true,
        flagsJson: true,
        template: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            passingScore: true,
            sections: true,
          },
        },
        application: {
          select: {
            id: true,
            job: { select: { id: true, companyId: true, recruiterId: true } },
          },
        },
        invite: {
          select: {
            id: true,
            application: {
              select: {
                id: true,
                job: { select: { id: true, companyId: true, recruiterId: true } },
              },
            },
          },
        },
      },
    });

    if (!attemptBase) {
      return jsonNoStore({ error: "Intento no encontrado" }, 404);
    }

    if (!isAttemptFinal(attemptBase.status)) {
      return jsonNoStore(
        { error: "La evaluación aún no ha sido completada" },
        400
      );
    }

    const isOwner = String(attemptBase.candidateId) === userId;
    const isAdmin = role === "ADMIN";
    const isRecruiter = role === "RECRUITER";

    const jobFromApplication = attemptBase.application?.job ?? null;
    const jobFromInvite = attemptBase.invite?.application?.job ?? null;
    const job = jobFromApplication || jobFromInvite;

    let recruiterCanView = false;
    if (isRecruiter && job) {
      const recruiterCompanyId = await getSessionCompanyId().catch(() => null);
      recruiterCanView =
        (recruiterCompanyId ? job.companyId === recruiterCompanyId : false) ||
        (job.recruiterId ? String(job.recruiterId) === userId : false);
    }

    if (!isOwner && !isAdmin && !recruiterCanView) {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const canSeeSolutions = isAdmin || recruiterCanView;
    const canSeeFlags = isAdmin || recruiterCanView;

    const [answeredCount, totalQuestions] = await Promise.all([
      prisma.attemptAnswer.count({ where: { attemptId: attemptBase.id } }),
      prisma.assessmentQuestion.count({
        where: { templateId: attemptBase.templateId, isActive: true },
      }),
    ]);

    if (!canSeeSolutions) {
      return jsonNoStore({
        attempt: {
          id: attemptBase.id,
          status: attemptBase.status,
          attemptNumber: attemptBase.attemptNumber,
          startedAt: attemptBase.startedAt,
          submittedAt: attemptBase.submittedAt,
          timeSpent: attemptBase.timeSpent,
          totalScore: attemptBase.totalScore,
          sectionScores: attemptBase.sectionScores,
          passed: attemptBase.passed,
          flagsJson: undefined,
        },
        template: attemptBase.template,
        candidate: undefined,
        answers: [],
        stats: {
          correctAnswers: undefined,
          answeredQuestions: answeredCount,
          totalQuestions,
          accuracy: undefined,
        },
        summaryOnly: true,
      });
    }

    const answersFull = await prisma.attemptAnswer.findMany({
      where: { attemptId: attemptBase.id },
      select: {
        id: true,
        questionId: true,
        selectedOptions: true,
        isCorrect: true,
        pointsEarned: true,
        timeSpent: true,
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
      orderBy: { id: "asc" },
    });

    const correctCount = answersFull.filter((a) => Boolean(a.isCorrect)).length;
    const accuracy =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const candidate = await prisma.user.findUnique({
      where: { id: attemptBase.candidateId },
      select: { id: true, name: true, email: true },
    });

    const result = {
      attempt: {
        id: attemptBase.id,
        status: attemptBase.status,
        attemptNumber: attemptBase.attemptNumber,
        startedAt: attemptBase.startedAt,
        submittedAt: attemptBase.submittedAt,
        timeSpent: attemptBase.timeSpent,
        totalScore: attemptBase.totalScore,
        sectionScores: attemptBase.sectionScores,
        passed: attemptBase.passed,
        flagsJson: canSeeFlags ? attemptBase.flagsJson : undefined,
      },
      template: attemptBase.template,
      candidate: candidate ?? undefined,
      answers: answersFull.map((answer) => ({
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
      summaryOnly: false,
    };

    return jsonNoStore(result);
  } catch (error) {
    console.error("Error fetching results:", error);
    return jsonNoStore({ error: "Error al cargar resultados" }, 500);
  }
}