// app/api/assessments/[templateId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return jsonNoStore({ error: "No autorizado" }, 401);
    }

    const user = session.user as SessionUser;
    const userId = String(user.id ?? "");
    const role = String(user.role ?? "").toUpperCase();

    if (!userId) {
      return jsonNoStore({ error: "No autorizado" }, 401);
    }

    if (role !== "CANDIDATE") {
      return jsonNoStore({ error: "Forbidden" }, 403);
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
        isActive: true,
        sections: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!template || !template.isActive) {
      return jsonNoStore({ error: "Template no encontrado" }, 404);
    }

    const normalizedTotalQuestions =
      typeof template.totalQuestions === "number" && template.totalQuestions > 0
        ? template.totalQuestions
        : template._count.questions;

    const normalizedSections = Array.isArray(template.sections)
      ? template.sections
      : [];

    const [attemptsUsed, lastAttempt] = await Promise.all([
      prisma.assessmentAttempt.count({
        where: {
          candidateId: userId,
          templateId: params.templateId,
          status: { in: ["SUBMITTED", "EVALUATED", "COMPLETED"] },
        },
      }),
      prisma.assessmentAttempt.findFirst({
        where: { candidateId: userId, templateId: params.templateId },
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

    const canRetry = Boolean(template.allowRetry);
    const maxAttempts = template.maxAttempts ?? 1;
    const canStart = canRetry ? attemptsUsed < maxAttempts : attemptsUsed === 0;

    return jsonNoStore({
      template: {
        ...template,
        totalQuestions: normalizedTotalQuestions,
        sections: normalizedSections,
      },
      userStatus: {
        attemptsUsed,
        maxAttempts,
        canStart,
        lastAttempt: lastAttempt || null,
      },
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return jsonNoStore({ error: "Error al cargar template" }, 500);
  }
}