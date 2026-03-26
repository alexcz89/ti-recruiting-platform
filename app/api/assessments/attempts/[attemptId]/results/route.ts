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

type FlagsJsonShape = {
  tooFast?: boolean;
};

type OptionLike = {
  id?: string;
  value?: string;
  text?: string;
  label?: string;
  [key: string]: unknown;
};

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

function sanitizeOptions(options: unknown): OptionLike[] {
  if (!Array.isArray(options)) return [];

  return options.map((opt) => {
    if (!opt || typeof opt !== "object") return {};
    const o = opt as Record<string, unknown>;

    return {
      id: typeof o.id === "string" ? o.id : undefined,
      value: typeof o.value === "string" ? o.value : undefined,
      text: typeof o.text === "string" ? o.text : undefined,
      label: typeof o.label === "string" ? o.label : undefined,
    };
  });
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
        tabSwitches: true,
        visibilityHidden: true,
        copyAttempts: true,
        pasteAttempts: true,
        rightClicks: true,
        focusLoss: true,
        pageHides: true,
        multiSession: true,
        severity: true,
        severityScore: true,
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
            job: {
              select: {
                id: true,
                companyId: true,
                recruiterId: true,
              },
            },
          },
        },
        invite: {
          select: {
            id: true,
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

    const flags = (attemptBase.flagsJson ?? {}) as FlagsJsonShape;

    const anticheat = canSeeFlags
      ? {
          tooFast: Boolean(flags.tooFast),
          tabSwitches: attemptBase.tabSwitches ?? 0,
          visibilityHidden: attemptBase.visibilityHidden ?? 0,
          copyAttempts: attemptBase.copyAttempts ?? 0,
          pasteAttempts: attemptBase.pasteAttempts ?? 0,
          rightClicks: attemptBase.rightClicks ?? 0,
          focusLoss: attemptBase.focusLoss ?? 0,
          pageHides: attemptBase.pageHides ?? 0,
          multiSession: attemptBase.multiSession ?? false,
          severity: String(attemptBase.severity ?? "NORMAL").toUpperCase(),
          severityScore: attemptBase.severityScore ?? 0,
        }
      : undefined;

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
          anticheat: undefined,
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
        flagsJson: canSeeFlags ? attemptBase.flagsJson : undefined,
        anticheat,
      },
      template: attemptBase.template,
      candidate: candidate ?? undefined,
      answers: answersFull.map((answer) => ({
        questionId: answer.questionId,
        section: answer.question.section,
        difficulty: answer.question.difficulty,
        questionText: answer.question.questionText,
        codeSnippet: answer.question.codeSnippet,
        options: sanitizeOptions(answer.question.options),
        selectedOptions: Array.isArray(answer.selectedOptions)
          ? answer.selectedOptions
          : [],
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
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    return jsonNoStore({ error: "Error al cargar resultados" }, 500);
  }
}