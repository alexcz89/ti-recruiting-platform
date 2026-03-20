// app/api/assessments/attempts/[attemptId]/answer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type SessionUser = {
  id?: string | null;
  role?: string | null;
};

type AnswerBody = {
  questionId?: unknown;
  selectedOptions?: unknown;
  timeSpent?: unknown;
};

type AttemptFlags = {
  questionOrder?: string[];
} | null;

type OptionShape = Record<string, unknown>;

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function badRequest(msg: string) {
  return jsonNoStore({ error: msg }, 400);
}

function keyOfOption(o: unknown) {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    const obj = o as OptionShape;
    return String(obj.id ?? obj.value ?? JSON.stringify(o));
  }
  return String(JSON.stringify(o));
}

// POST /api/assessments/attempts/[attemptId]/answer
export async function POST(
  request: Request,
  { params }: { params: { attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as SessionUser;
    const role = String(user.role ?? "").toUpperCase();
    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);
    if (!user.id) return jsonNoStore({ error: "No autorizado" }, 401);

    let body: AnswerBody;
    try {
      body = await request.json();
    } catch {
      return badRequest("Body inválido");
    }

    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";
    const selectedOptionsRaw = body.selectedOptions;
    const timeSpentRaw = body.timeSpent;

    if (!questionId) return badRequest("questionId requerido");
    if (!Array.isArray(selectedOptionsRaw)) {
      return badRequest("selectedOptions inválido");
    }

    const selectedOptions = Array.from(
      new Set(
        selectedOptionsRaw
          .filter(
            (x): x is string | number =>
              typeof x === "string" || typeof x === "number"
          )
          .map((x) => String(x).trim())
          .filter(Boolean)
      )
    );

    const timeSpent =
      typeof timeSpentRaw === "number" &&
      Number.isFinite(timeSpentRaw) &&
      timeSpentRaw >= 0 &&
      timeSpentRaw <= 60 * 60 * 12
        ? Math.floor(timeSpentRaw)
        : null;

    if (selectedOptions.length === 0) {
      return badRequest("Debes seleccionar al menos una opción");
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id: params.attemptId },
        select: {
          id: true,
          candidateId: true,
          templateId: true,
          status: true,
          expiresAt: true,
          flagsJson: true,
          template: { select: { penalizeWrong: true } },
        },
      });

      if (!attempt) {
        throw Object.assign(new Error("NOT_FOUND"), {
          code: "ATTEMPT_NOT_FOUND",
        });
      }
      if (attempt.candidateId !== user.id) {
        throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
      }

      const st = String(attempt.status ?? "").toUpperCase();
      if (st !== "IN_PROGRESS") {
        throw Object.assign(new Error("INVALID_STATE"), {
          code: "INVALID_STATE",
        });
      }

      if (attempt.expiresAt && now > attempt.expiresAt) {
        throw Object.assign(new Error("EXPIRED"), { code: "EXPIRED" });
      }

      const meta = (attempt.flagsJson as AttemptFlags) || null;
      const order: string[] = Array.isArray(meta?.questionOrder)
        ? meta.questionOrder
        : [];

      if (order.length && !order.includes(questionId)) {
        throw Object.assign(new Error("QUESTION_NOT_IN_ATTEMPT"), {
          code: "QUESTION_NOT_IN_ATTEMPT",
        });
      }

      const question = await tx.assessmentQuestion.findFirst({
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
        throw Object.assign(new Error("QUESTION_NOT_FOUND"), {
          code: "QUESTION_NOT_FOUND",
        });
      }

      if (!question.allowMultiple && selectedOptions.length > 1) {
        throw Object.assign(new Error("SINGLE_CHOICE_ONLY"), {
          code: "SINGLE_CHOICE_ONLY",
        });
      }

      const options = Array.isArray(question.options) ? question.options : [];
      const optionKeys = new Set(options.map((o) => keyOfOption(o)));

      for (const id of selectedOptions) {
        if (!optionKeys.has(id)) {
          throw Object.assign(new Error("INVALID_OPTION"), {
            code: "INVALID_OPTION",
          });
        }
      }

      const correctOptions = options
        .filter((o) => {
          if (!o || typeof o !== "object" || Array.isArray(o)) return false;
          return Boolean((o as OptionShape).isCorrect);
        })
        .map((o) => keyOfOption(o));

      const isCorrect =
        correctOptions.length === selectedOptions.length &&
        correctOptions.every((id) => selectedOptions.includes(id));

      let pointsEarned = 0;
      if (isCorrect) pointsEarned = 1;
      else if (attempt.template.penalizeWrong) pointsEarned = -0.25;

      let created = false;
      let answerId: string | null = null;

      try {
        const row = await tx.attemptAnswer.create({
          data: {
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
        created = true;
        answerId = row.id;
      } catch (e: unknown) {
        if (
          typeof e !== "object" ||
          e === null ||
          !("code" in e) ||
          String(e.code) !== "P2002"
        ) {
          throw e;
        }

        const row = await tx.attemptAnswer.update({
          where: {
            attemptId_questionId: {
              attemptId: params.attemptId,
              questionId,
            },
          },
          data: {
            selectedOptions,
            isCorrect,
            pointsEarned,
            timeSpent: timeSpent ?? undefined,
            answeredAt: now,
          },
          select: { id: true },
        });
        answerId = row.id;
      }

      if (created) {
        await tx.assessmentQuestion.update({
          where: { id: questionId },
          data: { timesUsed: { increment: 1 } },
        });
      }

      return { answerId };
    });

    return jsonNoStore({ success: true, answerId: result.answerId });
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code || "")
        : "";

    if (code === "ATTEMPT_NOT_FOUND") {
      return jsonNoStore({ error: "Intento no encontrado" }, 404);
    }
    if (code === "FORBIDDEN") {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }
    if (code === "INVALID_STATE") {
      return badRequest("El intento ya fue completado");
    }
    if (code === "EXPIRED") {
      return badRequest("El tiempo ha expirado");
    }
    if (code === "QUESTION_NOT_IN_ATTEMPT") {
      return badRequest("Pregunta inválida para este intento");
    }
    if (code === "QUESTION_NOT_FOUND") {
      return jsonNoStore({ error: "Pregunta no encontrada" }, 404);
    }
    if (code === "SINGLE_CHOICE_ONLY") {
      return badRequest("Esta pregunta solo permite una opción");
    }
    if (code === "INVALID_OPTION") {
      return badRequest("Opción inválida");
    }

    console.error("Error saving answer:", error);
    return jsonNoStore({ error: "Error al guardar respuesta" }, 500);
  }
}