// app/api/assessments/attempts/[attemptId]/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { NotificationService } from "@/lib/notifications/service";
import { Prisma } from "@prisma/client";
import { getCurrentBillingCycle } from "@/lib/assessments/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ONE_CREDIT = new Prisma.Decimal(1);

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const role = String(user?.role ?? "").toUpperCase();
    if (role !== "CANDIDATE") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      include: {
        template: {
          select: {
            passingScore: true,
            sections: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                section: true,
              },
            },
          },
        },
        invite: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                title: true,
                recruiterId: true,
              },
            },
          },
        },
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!attempt) {
      return jsonNoStore({ error: "Intento no encontrado" }, 404);
    }

    if (attempt.candidateId !== user.id) {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const currentStatus = String(attempt.status ?? "").toUpperCase();

    if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(currentStatus)) {
      return jsonNoStore({ error: "El intento ya fue enviado" }, 400);
    }

    if (currentStatus !== "IN_PROGRESS") {
      return jsonNoStore({ error: "El intento no está en progreso" }, 400);
    }

    const now = new Date();

    if (attempt.expiresAt && now > attempt.expiresAt) {
      return jsonNoStore({ error: "Tiempo expirado" }, 400);
    }

    if (!attempt.startedAt) {
      return jsonNoStore(
        { error: "El intento no ha sido iniciado correctamente" },
        400
      );
    }

    const answeredCount = attempt.answers.length;
    const totalPoints = attempt.answers.reduce(
      (sum, answer) => sum + (answer.pointsEarned || 0),
      0
    );

    const activeQuestions = await prisma.assessmentQuestion.findMany({
      where: {
        templateId: attempt.templateId,
        isActive: true,
      },
      select: {
        id: true,
        section: true,
        type: true,
        testCases: {
          select: {
            points: true,
          },
        },
      },
    });

    const questionMaxPoints = activeQuestions.map((question) => {
      if (question.type === "CODING" && question.testCases.length > 0) {
        return {
          id: question.id,
          section: question.section,
          maxPts: question.testCases.reduce(
            (sum, testCase) => sum + (Number(testCase.points) || 0),
            0
          ),
        };
      }

      return {
        id: question.id,
        section: question.section,
        maxPts: 1,
      };
    });

    const totalMaxPoints = questionMaxPoints.reduce(
      (sum, question) => sum + question.maxPts,
      0
    );

    const maxPoints = totalMaxPoints || answeredCount || 1;

    const totalScore = Math.max(
      0,
      Math.min(100, Math.round((totalPoints / maxPoints) * 100))
    );

    const sections = (attempt.template.sections as any[]) || [];
    const sectionScores: Record<string, number> = {};

    for (const section of sections) {
      const sectionName = String(section?.name || "");
      if (!sectionName) continue;

      const sectionAnswers = attempt.answers.filter(
        (answer) => answer.question.section === sectionName
      );

      const sectionPoints = sectionAnswers.reduce(
        (sum, answer) => sum + (answer.pointsEarned || 0),
        0
      );

      const sectionMaxPts = questionMaxPoints
        .filter((question) => question.section === sectionName)
        .reduce((sum, question) => sum + question.maxPts, 0);

      sectionScores[sectionName] =
        sectionMaxPts > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((sectionPoints / sectionMaxPts) * 100))
            )
          : 0;
    }

    const timeSpent = attempt.answers.reduce(
      (sum, answer) => sum + (answer.timeSpent || 0),
      0
    );

    const flags: any =
      attempt.flagsJson && typeof attempt.flagsJson === "object"
        ? { ...(attempt.flagsJson as any) }
        : {};

    if (answeredCount > 0) {
      const avgTimePerQuestion = timeSpent / answeredCount;
      if (avgTimePerQuestion < 5) {
        flags.tooFast = true;
      }
    }

    const passingScore = Number((attempt.template as any)?.passingScore ?? 0);
    const passed = totalScore >= passingScore;

    try {
      await prisma.$transaction(async (tx) => {
        const updatedAttempt = await tx.assessmentAttempt.updateMany({
          where: {
            id: params.attemptId,
            candidateId: user.id,
            status: "IN_PROGRESS" as any,
          },
          data: {
            status: "SUBMITTED" as any,
            submittedAt: now,
            totalScore,
            sectionScores,
            passed,
            timeSpent,
            flagsJson: flags,
          },
        });

        if (updatedAttempt.count === 0) {
          throw new Error("STATE_INVALID_OR_ALREADY_SUBMITTED");
        }

        let inviteIdForLedger: string | null = attempt.inviteId ?? null;

        if (attempt.inviteId) {
          await tx.assessmentInvite.updateMany({
            where: {
              id: attempt.inviteId,
              status: { in: ["SENT", "STARTED"] as any },
            },
            data: {
              status: "SUBMITTED" as any,
              submittedAt: now,
            },
          });
        } else if (attempt.applicationId) {
          const inviteUpdateResult = await tx.assessmentInvite.updateMany({
            where: {
              candidateId: user.id,
              templateId: attempt.templateId,
              applicationId: attempt.applicationId,
              status: { in: ["SENT", "STARTED"] as any },
            },
            data: {
              status: "SUBMITTED" as any,
              submittedAt: now,
            },
          });

          if (inviteUpdateResult.count > 0) {
            const linkedInvite = await tx.assessmentInvite.findFirst({
              where: {
                candidateId: user.id,
                templateId: attempt.templateId,
                applicationId: attempt.applicationId,
                status: "SUBMITTED" as any,
              },
              select: { id: true },
              orderBy: { createdAt: "desc" },
            });

            inviteIdForLedger = linkedInvite?.id ?? null;
          }
        }

        if (inviteIdForLedger) {
          const chargedLedger = await tx.assessmentInviteChargeLedger.updateMany({
            where: {
              inviteId: inviteIdForLedger,
              kind: "ASSESSMENT_INVITE" as any,
              cycle: getCurrentBillingCycle(),
              status: "RESERVED" as any,
            },
            data: {
              status: "CHARGED" as any,
              chargedAmount: ONE_CREDIT,
            },
          });

          if (chargedLedger.count > 0) {
            await tx.assessmentInvite.update({
              where: { id: inviteIdForLedger },
              data: {
                chargedAt: now,
                chargeCount: {
                  increment: 1,
                },
              },
            });
          }
        }
      });
    } catch (error: any) {
      if (
        String(error?.message || "").includes(
          "STATE_INVALID_OR_ALREADY_SUBMITTED"
        )
      ) {
        return jsonNoStore(
          { error: "No se pudo enviar (estado inválido o ya enviado)" },
          400
        );
      }

      throw error;
    }

    (async () => {
      try {
        const recruiterId = attempt.invite?.job?.recruiterId;

        if (!recruiterId) {
          console.warn(
            "[POST /api/assessments/attempts/[attemptId]/submit] recruiterId no encontrado; se omite notificación"
          );
          return;
        }

        await NotificationService.create({
          userId: recruiterId,
          type: "ASSESSMENT_COMPLETED",
          metadata: {
            candidateName:
              attempt.candidate.name || attempt.candidate.email || "Candidato",
            candidateId: attempt.candidateId,
            jobTitle: attempt.invite?.job?.title || "Vacante",
            jobId: attempt.invite?.job?.id || "",
            assessmentId: attempt.inviteId || "",
            attemptId: attempt.id,
            score: totalScore,
            passed,
          },
        });
      } catch (notifErr) {
        console.warn(
          "[POST /api/assessments/attempts/[attemptId]/submit] Notification failed:",
          notifErr
        );
      }
    })();

    return jsonNoStore({
      success: true,
      totalScore,
      sectionScores,
      passed,
      timeSpent,
    });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return jsonNoStore({ error: "Error al enviar evaluación" }, 500);
  }
}