// app/api/assessments/code/custom-run/route.ts
// Ejecuta el código del candidato con un input personalizado (sin comparar con test cases).
// Solo para candidatos con un intento IN_PROGRESS.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { judge0Service } from "@/lib/code-execution/judge0-service";
import { validateReadOnlySqlQuery, validateSqlDatasetSetup } from "@/lib/code-execution/sql-service";

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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as { id?: string; role?: string };
    if (String(user?.role ?? "").toUpperCase() !== "CANDIDATE") {
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

    // Verificar que el intento pertenece al candidato y está en progreso
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, candidateId: true, status: true, expiresAt: true },
    });

    if (!attempt) return jsonNoStore({ error: "Intento no encontrado" }, 404);
    if (attempt.candidateId !== user.id) return jsonNoStore({ error: "No autorizado" }, 403);
    if (String(attempt.status).toUpperCase() !== "IN_PROGRESS") {
      return jsonNoStore({ error: "El intento no está en progreso" }, 400);
    }
    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return jsonNoStore({ error: "Tiempo expirado" }, 400);
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
    const recentCount = await prisma.codeExecution.count({
      where: {
        candidateId: user.id,
        attemptId,
        questionId,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= 30) {
      return jsonNoStore({ error: "Demasiadas ejecuciones. Espera un momento." }, 429);
    }

    // Ejecutar con input personalizado como test case único (sin expected output)
    const result = await judge0Service.executeCode({
      code,
      language,
      testCases: [
        {
          id: "custom",
          input: customInput,
          expectedOutput: "__NO_CHECK__", // no comparamos output
          timeoutMs: 5000,
          memoryLimitMb: 256,
        },
      ],
    });

    const testResult = result.testResults?.[0];
    const output = testResult?.actualOutput ?? result.output ?? "";
    const error = testResult?.error ?? result.error ?? "";

    return jsonNoStore({
      success: true,
      output: truncate(output),
      error: truncate(error),
      executionTimeMs: result.executionTimeMs,
      status: result.status,
    });
  } catch (err: any) {
    console.error("[POST /api/assessments/code/custom-run] Error:", err);
    return jsonNoStore({ error: "Error al ejecutar el código", details: String(err?.message ?? "") }, 500);
  }
}
