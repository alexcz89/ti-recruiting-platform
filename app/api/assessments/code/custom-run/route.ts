export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { judge0Service } from "@/lib/code-execution/judge0-service";
import { validateReadOnlySqlQuery, validateSqlDatasetSetup } from "@/lib/code-execution/sql-service";
import {
  ASSESSMENT_EXPIRED_CODE,
  isAssessmentExpired,
} from "@/lib/assessments/expiration";

const CUSTOM_RUN_LIMIT = 30;
const CUSTOM_STATUS_PREFIX = "CUSTOM_";

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function truncate(value: unknown, max = 4000): string {
  if (value == null) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.length <= max ? text : `${text.slice(0, max)}\n…[truncado]`;
}

export async function POST(request: Request) {
  let reservationId: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as { id?: string; role?: string };
    if (String(user.role ?? "").toUpperCase() !== "CANDIDATE") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }
    if (!user.id) return jsonNoStore({ error: "Usuario inválido" }, 401);

    const body = await request.json().catch(() => ({}));
    const attemptId = String(body.attemptId ?? "").trim();
    const questionId = String(body.questionId ?? "").trim();
    const code = typeof body.code === "string" ? body.code : "";
    const language = String(body.language ?? "").trim();
    const customInput = typeof body.customInput === "string" ? body.customInput : "";

    if (!attemptId || !questionId || !code || !language) {
      return jsonNoStore({ error: "Faltan campos requeridos" }, 400);
    }
    if (code.length > 200_000) {
      return jsonNoStore({ error: "Código demasiado largo" }, 400);
    }
    if (customInput.length > 10_000) {
      return jsonNoStore({ error: "Input personalizado demasiado largo" }, 400);
    }
    if (!judge0Service.isLanguageSupported(language)) {
      return jsonNoStore({ error: `Lenguaje no soportado: ${language}` }, 400);
    }

    if (language === "sql") {
      const queryValidation = validateReadOnlySqlQuery(code);
      if (!queryValidation.ok) {
        return jsonNoStore({ error: queryValidation.error }, 400);
      }

      const datasetValidation = validateSqlDatasetSetup(customInput);
      if (!datasetValidation.ok) {
        return jsonNoStore({ error: datasetValidation.error }, 400);
      }
    }

    // Rate limit ligero: máx 30 custom runs por minuto por candidato
    const since = new Date(Date.now() - 60_000);
    const reservation = await prisma.$transaction(async (tx) => {
      // PostgreSQL transaction-scoped lock serializes the count+reservation for
      // this candidate/attempt/question without holding a lock during Judge0.
      const lockKey = `custom-run:${user.id}:${attemptId}:${questionId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: {
          id: true,
          candidateId: true,
          templateId: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!attempt) return { error: "Intento no encontrado", status: 404 } as const;
      if (attempt.candidateId !== user.id) {
        return { error: "No autorizado", status: 403 } as const;
      }
      if (String(attempt.status).toUpperCase() !== "IN_PROGRESS") {
        return { error: "El intento no está en progreso", status: 400 } as const;
      }
      if (isAssessmentExpired(attempt.expiresAt)) {
        return {
          error: "Tiempo expirado",
          code: ASSESSMENT_EXPIRED_CODE,
          status: 410,
        } as const;
      }

      const question = await tx.assessmentQuestion.findFirst({
        where: {
          id: questionId,
          templateId: attempt.templateId,
          type: "CODING",
          isActive: true,
        },
        select: { id: true },
      });
      if (!question) return { error: "Pregunta no válida", status: 404 } as const;

      const recentCount = await tx.codeExecution.count({
        where: {
          candidateId: user.id,
          attemptId,
          questionId,
          status: { startsWith: CUSTOM_STATUS_PREFIX },
          createdAt: { gte: since },
        },
      });
      if (recentCount >= CUSTOM_RUN_LIMIT) {
        return {
          error: "Demasiadas ejecuciones. Espera un momento.",
          status: 429,
        } as const;
      }

      const execution = await tx.codeExecution.create({
        data: {
          attemptId,
          questionId,
          candidateId: user.id,
          code,
          language,
          status: "CUSTOM_PENDING",
          isSubmission: false,
        },
        select: { id: true },
      });
      return { executionId: execution.id } as const;
    });

    if ("error" in reservation) {
      return jsonNoStore(
        {
          error: reservation.error,
          ...("code" in reservation ? { code: reservation.code } : {}),
        },
        reservation.status
      );
    }
    reservationId = reservation.executionId;

    try {
      const result = await judge0Service.executeCode({
        code,
        language,
        testCases: [{
          id: "custom",
          input: customInput,
          expectedOutput: "__NO_CHECK__",
          timeoutMs: 5000,
          memoryLimitMb: 256,
        }],
      });

      const testResult = result.testResults?.[0];
      const output = testResult?.actualOutput ?? result.output ?? "";
      const error = testResult?.error ?? result.error ?? "";
      await prisma.codeExecution.update({
        where: { id: reservationId },
        data: {
          status: "CUSTOM_COMPLETED",
          output: truncate(output),
          error: truncate(error) || null,
          executionTimeMs: result.executionTimeMs ?? null,
          testResults: {
            providerStatus: result.status,
            customInput: truncate(customInput, 10_000),
            results: result.testResults ?? [],
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return jsonNoStore({
        success: true,
        output: truncate(output),
        error: truncate(error),
        executionTimeMs: result.executionTimeMs,
        status: result.status,
      });
    } catch (providerError) {
      const details = truncate(
        providerError instanceof Error ? providerError.message : providerError
      );
      await prisma.codeExecution.update({
        where: { id: reservationId },
        data: { status: "CUSTOM_ERROR", error: details || "Judge0 error" },
      });
      reservationId = null;
      return jsonNoStore({ error: "Error al ejecutar el código" }, 502);
    }
  } catch (err) {
    if (reservationId) {
      await prisma.codeExecution.update({
        where: { id: reservationId },
        data: {
          status: "CUSTOM_ERROR",
          error: truncate(err instanceof Error ? err.message : err),
        },
      }).catch(() => {});
    }
    console.error("[POST /api/assessments/code/custom-run] Error:", err);
    return jsonNoStore({ error: "Error al ejecutar el código" }, 500);
  }
}
