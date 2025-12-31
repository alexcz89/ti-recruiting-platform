// app/api/assessments/attempts/[attemptId]/answer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function badRequest(msg: string) {
  return NextResponse.json(
    { error: msg },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

// POST /api/assessments/attempts/[attemptId]/answer
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return badRequest("Body inválido");
    }

    const questionId = String(body?.questionId || "");
    const selectedOptionsRaw = body?.selectedOptions;
    const timeSpentRaw = body?.timeSpent;

    if (!questionId) return badRequest("questionId requerido");
    if (!Array.isArray(selectedOptionsRaw)) return badRequest("selectedOptions inválido");

    const selectedOptions = Array.from(
      new Set(selectedOptionsRaw.map((x: any) => String(x)))
    ).filter(Boolean);

    const timeSpent =
      typeof timeSpentRaw === "number" && Number.isFinite(timeSpentRaw) && timeSpentRaw >= 0
        ? Math.floor(timeSpentRaw)
        : null;

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: params.attemptId },
      select: {
        id: true,
        candidateId: true,
        templateId: true,
        status: true,
        expiresAt: true,
        template: { select: { penalizeWrong: true } },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    if (attempt.candidateId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return badRequest("El intento ya fue completado");
    }

    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return badRequest("El tiempo ha expirado");
    }

    const question = await prisma.assessmentQuestion.findFirst({
      where: {
        id: questionId,
        templateId: attempt.templateId,
        isActive: true,
      },
      select: {
        id: true,
        allowMultiple: true,
        options: true,
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
    }

    if (!question.allowMultiple && selectedOptions.length > 1) {
      return badRequest("Esta pregunta solo permite una opción");
    }

    const options = Array.isArray(question.options) ? (question.options as any[]) : [];
    const optionIds = new Set(options.map((o) => String(o?.id)));

    if (selectedOptions.length === 0) {
      return badRequest("Debes seleccionar al menos una opción");
    }

    for (const id of selectedOptions) {
      if (!optionIds.has(id)) return badRequest("Opción inválida");
    }

    const correctOptions = options
      .filter((o) => o?.isCorrect)
      .map((o) => String(o?.id));

    const isCorrect =
      correctOptions.length === selectedOptions.length &&
      correctOptions.every((id) => selectedOptions.includes(id));

    let pointsEarned = 0;
    if (isCorrect) pointsEarned = 1;
    else if (attempt.template.penalizeWrong) pointsEarned = -0.25;

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.attemptAnswer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId: params.attemptId,
            questionId,
          },
        },
        select: { id: true },
      });

      const answer = await tx.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: params.attemptId,
            questionId,
          },
        },
        update: {
          selectedOptions,
          isCorrect,
          pointsEarned,
          timeSpent: timeSpent ?? undefined,
          // ✅ CLAVE: si el usuario cambia respuesta, que “cuente” como lo último
          answeredAt: now,
        },
        create: {
          attemptId: params.attemptId,
          questionId,
          selectedOptions,
          isCorrect,
          pointsEarned,
          timeSpent: timeSpent ?? undefined,
          answeredAt: now,
        },
        select: { id: true },
      });

      if (!existing) {
        await tx.assessmentQuestion.update({
          where: { id: questionId },
          data: { timesUsed: { increment: 1 } },
        });
      }

      return answer;
    });

    return NextResponse.json(
      { success: true, answerId: result.id },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error saving answer:", error);
    return NextResponse.json({ error: "Error al guardar respuesta" }, { status: 500 });
  }
}
