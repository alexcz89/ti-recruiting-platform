// app/api/assessments/attempts/[attemptId]/submit/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { NotificationService } from "@/lib/notifications/service";
import { chargeCompletionCredits } from "@/lib/assessments/credits";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

type TemplateSection = {
  name?: unknown;
  questions?: unknown;
};

type FlagsShape = Record<string, unknown> & {
  tooFast?: boolean;
};

function jsonNoStore(data: unknown, status = 200) {
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

    const user = session.user as SessionUser;
    const userId = String(user.id ?? "");
    const role = String(user.role ?? "").toUpperCase();

    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);
    if (!userId) return jsonNoStore({ error: "No autorizado" }, 401);

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      include: {
        template: { select: { passingScore: true, sections: true } },
        answers: { include: { question: { select: { section: true } } } },
        invite: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                title: true,
                recruiterId: true,
                companyId: true,
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

    if (!attempt) return jsonNoStore({ error: "Intento no encontrado" }, 404);
    if (attempt.candidateId !== userId) {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const st = String(attempt.status ?? "").toUpperCase();
    if (["SUBMITTED", "EVALUATED", "COMPLETED"].includes(st)) {
      return jsonNoStore({ error: "El intento ya fue enviado" }, 400);
    }
    if (st !== "IN_PROGRESS") {
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
      (sum, a) => sum + (a.pointsEarned || 0),
      0
    );

    const totalQuestions = await prisma.assessmentQuestion.count({
      where: { templateId: attempt.templateId, isActive: true },
    });

    const maxPoints = totalQuestions || answeredCount || 0;
    const totalScore =
      maxPoints > 0 ? Math.max(0, Math.round((totalPoints / maxPoints) * 100)) : 0;

    const rawSections = Array.isArray(attempt.template.sections)
      ? (attempt.template.sections as TemplateSection[])
      : [];

    const sectionScores: Record<string, number> = {};

    for (const section of rawSections) {
      const sectionName =
        typeof section?.name === "string" ? section.name : "";
      if (!sectionName) continue;

      const sectionAnswers = attempt.answers.filter(
        (a) => a.question.section === sectionName
      );
      const sectionPoints = sectionAnswers.reduce(
        (sum, a) => sum + (a.pointsEarned || 0),
        0
      );

      const sectionMax =
        typeof section?.questions === "number" ? section.questions : 0;

      sectionScores[sectionName] =
        sectionMax > 0
          ? Math.max(0, Math.round((sectionPoints / sectionMax) * 100))
          : 0;
    }

    const timeSpent = attempt.answers.reduce(
      (sum, a) => sum + (a.timeSpent || 0),
      0
    );

    const flags: FlagsShape =
      attempt.flagsJson && typeof attempt.flagsJson === "object"
        ? { ...(attempt.flagsJson as Record<string, unknown>) }
        : {};

    if (answeredCount > 0) {
      const avgTimePerQuestion = timeSpent / answeredCount;
      if (avgTimePerQuestion < 5) flags.tooFast = true;
    }

    const passingScore =
      typeof attempt.template.passingScore === "number"
        ? attempt.template.passingScore
        : 0;

    const passed = totalScore >= passingScore;

    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.assessmentAttempt.updateMany({
          where: {
            id: params.attemptId,
            candidateId: userId,
            status: "IN_PROGRESS",
          },
          data: {
            status: "SUBMITTED",
            submittedAt: now,
            totalScore,
            sectionScores,
            passed,
            timeSpent,
            flagsJson: flags as Prisma.InputJsonObject,
          },
        });

        if (updated.count === 0) {
          throw new Error("STATE_INVALID_OR_ALREADY_SUBMITTED");
        }

        if (attempt.inviteId) {
          await tx.assessmentInvite.updateMany({
            where: {
              id: attempt.inviteId,
              status: { in: ["SENT", "STARTED"] },
            },
            data: { status: "SUBMITTED", submittedAt: now },
          });
        } else if (attempt.applicationId) {
          await tx.assessmentInvite.updateMany({
            where: {
              candidateId: userId,
              templateId: attempt.templateId,
              applicationId: attempt.applicationId,
              status: { in: ["SENT", "STARTED"] },
            },
            data: { status: "SUBMITTED", submittedAt: now },
          });
        }
      });
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        e.message.includes("STATE_INVALID_OR_ALREADY_SUBMITTED")
      ) {
        return jsonNoStore(
          { error: "No se pudo enviar (estado inválido o ya enviado)" },
          400
        );
      }
      throw e;
    }

    const sideEffects: Promise<unknown>[] = [];

    if (attempt.inviteId) {
      sideEffects.push(
        chargeCompletionCredits(attempt.inviteId)
          .then((chargeResult) => {
            if (chargeResult.success) {
              console.log(
                `[POST /api/assessments/submit] ✓ Credits charged for invite ${attempt.inviteId} ` +
                  `(company: ${attempt.invite?.job?.companyId}, candidate: ${attempt.candidateId})`
              );
            } else {
              console.error(
                `[POST /api/assessments/submit] ✗ Failed to charge credits: ${chargeResult.message}`
              );
            }
          })
          .catch((creditErr) => {
            console.error(
              "[POST /api/assessments/submit] Credit charge error:",
              creditErr
            );
          })
      );
    } else {
      console.warn(
        "[POST /api/assessments/submit] No inviteId, skipping credit charge " +
          `(attempt: ${attempt.id})`
      );
    }

    const recruiterId = attempt.invite?.job?.recruiterId;
    if (recruiterId) {
      sideEffects.push(
        NotificationService.create({
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
        }).catch((notifErr) => {
          console.warn(
            "[POST /api/assessments/submit] Notification failed:",
            notifErr
          );
        })
      );
    } else {
      console.warn(
        "[POST /api/assessments/submit] No recruiterId found, skipping notification"
      );
    }

    await Promise.allSettled(sideEffects);

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