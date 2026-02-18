// app/api/assessments/code/execute/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { judge0Service } from "@/lib/code-execution/judge0-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ExecuteCodeRequest {
  attemptId: string;
  questionId: string;
  code: string;
  language: string;
  isSubmission?: boolean; // true = final submission, false = test run
}

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function truncateText(v: unknown, max = 8000): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v : String(v);
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n…[truncated]";
}

function parseStringArrayLoose(v: any): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
      return null;
    } catch {
      if (v.includes(",")) return v.split(",").map((x) => x.trim()).filter(Boolean);
      return null;
    }
  }
  return null;
}

type DbTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean | null;
  points?: number | null;
  timeoutMs?: number | null;
  memoryLimitMb?: number | null;
  orderIndex?: number | null;
};

/**
 * Best-effort: tus testcases NO están en question.testCases, así que los buscamos
 * en modelos comunes. Ajusta la lista si tu modelo se llama diferente.
 */
async function loadTestCasesBestEffort(args: {
  questionId: string;
  includeHidden: boolean;
}): Promise<DbTestCase[]> {
  const prismaAny = prisma as any;

  const candidateModels = [
    "codeTestCase",
    "assessmentTestCase",
    "codingTestCase",
    "assessmentCodingTestCase",
    "assessmentQuestionTestCase",
    "testCase",
    "testCases",
  ] as const;

  for (const modelName of candidateModels) {
    const model = prismaAny?.[modelName];
    if (!model?.findMany) continue;

    try {
      const rows = await model.findMany({
        where: args.includeHidden ? { questionId: args.questionId } : { questionId: args.questionId, isHidden: false },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          input: true,
          expectedOutput: true,
          isHidden: true,
          points: true,
          timeoutMs: true,
          memoryLimitMb: true,
          orderIndex: true,
        },
      });

      if (Array.isArray(rows)) return rows as DbTestCase[];
    } catch {
      // si ese modelo existe pero no tiene esos campos, probamos el siguiente
      continue;
    }
  }

  return [];
}

/**
 * Best-effort rate limit usando un modelo tipo CodeExecution si existe.
 * Si no existe, NO bloquea el endpoint.
 */
async function enforceRateLimitBestEffort(args: {
  candidateId: string;
  attemptId: string;
  questionId: string;
  isSubmission: boolean;
}) {
  const prismaAny = prisma as any;
  const model = prismaAny?.codeExecution;
  if (!model?.count) return; // tu schema actual no lo tiene

  const now = Date.now();
  const limits = args.isSubmission
    ? { windowMs: 5 * 60 * 1000, max: 5 }
    : { windowMs: 60 * 1000, max: 20 };

  const since = new Date(now - limits.windowMs);

  try {
    // Si tu modelo NO tiene createdAt, esto puede fallar: lo ignoramos.
    const count = await model.count({
      where: {
        candidateId: args.candidateId,
        attemptId: args.attemptId,
        questionId: args.questionId,
        createdAt: { gte: since },
      },
    });

    if (count >= limits.max) {
      const seconds = Math.ceil(limits.windowMs / 1000);
      throw new Error(`Rate limit: demasiadas ejecuciones. Intenta de nuevo en ${seconds}s.`);
    }
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const looksLikeNoCreatedAt = msg.includes("Unknown argument") && msg.includes("createdAt");
    if (looksLikeNoCreatedAt) return;

    if (msg.toLowerCase().includes("rate limit")) throw err;

    console.warn("[Code Execution] Rate limit check skipped:", msg);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonNoStore({ error: "No autorizado" }, 401);

    const user = session.user as any;
    const role = String(user?.role ?? "").toUpperCase();
    if (role !== "CANDIDATE") return jsonNoStore({ error: "Forbidden" }, 403);

    const body: ExecuteCodeRequest = await request.json();
    const { attemptId, questionId, code, language, isSubmission = false } = body;

    if (!attemptId || !questionId || !code || !language) {
      return jsonNoStore({ error: "Faltan campos requeridos" }, 400);
    }

    if (String(code).length > 200_000) {
      return jsonNoStore({ error: "Código demasiado largo" }, 400);
    }

    // Verify attempt ownership
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        candidateId: true,
        status: true,
        expiresAt: true,
        templateId: true,
      },
    });

    if (!attempt) return jsonNoStore({ error: "Intento no encontrado" }, 404);
    if (attempt.candidateId !== user.id) return jsonNoStore({ error: "No autorizado" }, 403);

    const attemptStatus = String(attempt.status ?? "").toUpperCase();
    if (attemptStatus !== "IN_PROGRESS") {
      return jsonNoStore({ error: "El intento no está en progreso" }, 400);
    }

    if (attempt.expiresAt && new Date() > attempt.expiresAt) {
      return jsonNoStore({ error: "Tiempo expirado" }, 400);
    }

    if (!judge0Service.isLanguageSupported(language)) {
      return jsonNoStore(
        {
          error: `Lenguaje no soportado: ${language}`,
          supportedLanguages: judge0Service.getSupportedLanguages(),
        },
        400
      );
    }

    // Rate limit (best-effort, no rompe si no existe codeExecution)
    await enforceRateLimitBestEffort({
      candidateId: user.id,
      attemptId,
      questionId,
      isSubmission,
    });

    // Get question (SIN testCases relation, porque tu modelo no la tiene)
    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        templateId: true,
        type: true,
        allowedLanguages: true,
      },
    });

    if (!question) return jsonNoStore({ error: "Pregunta no encontrada" }, 404);

    if (String(question.type ?? "").toUpperCase() !== "CODING") {
      return jsonNoStore({ error: "Esta pregunta no es de tipo CODING" }, 400);
    }

    if (question.templateId !== attempt.templateId) {
      return jsonNoStore({ error: "La pregunta no pertenece a este template" }, 400);
    }

    // Allowed languages (defensive)
    const allowedLanguages = parseStringArrayLoose(question.allowedLanguages as any);
    if (allowedLanguages && !allowedLanguages.includes(language)) {
      return jsonNoStore(
        {
          error: "Lenguaje no permitido para esta pregunta",
          allowedLanguages,
        },
        400
      );
    }

    // Load test cases best-effort (incluye hidden solo si esSubmission)
    const dbTestCases = await loadTestCasesBestEffort({
      questionId,
      includeHidden: isSubmission,
    });

    if (!dbTestCases.length) {
      return jsonNoStore({ error: "Esta pregunta no tiene test cases configurados" }, 400);
    }

    const testCases = dbTestCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      timeoutMs: tc.timeoutMs ?? undefined,
      memoryLimitMb: tc.memoryLimitMb ?? undefined,
    }));

    console.log(
      `[Code Execution] ${isSubmission ? "SUBMIT" : "RUN"} ${language} q=${questionId} attempt=${attemptId}`
    );

    const executionResult = await judge0Service.executeCode({
      code,
      language,
      testCases,
    });

    // Calculate points earned
    const tcById = new Map(dbTestCases.map((t) => [t.id, t]));
    let pointsEarned = 0;
    if (executionResult.testResults) {
      for (const tr of executionResult.testResults) {
        if (tr.passed) {
          const tc = tcById.get(tr.testCaseId);
          pointsEarned += tc?.points ? Number(tc.points) : 0;
        }
      }
    }

    // Best-effort: guardar ejecución si existe modelo codeExecution
    const prismaAny = prisma as any;
    let executionId: string | null = null;

    try {
      if (prismaAny?.codeExecution?.create) {
        const storedOutput = truncateText(executionResult.output, 12000);
        const storedError = truncateText(executionResult.error, 12000);

        const created = await prismaAny.codeExecution.create({
          data: {
            attemptId,
            questionId,
            candidateId: user.id,
            code,
            language,
            status: executionResult.status,
            output: storedOutput,
            error: storedError,
            executionTimeMs: executionResult.executionTimeMs,
            memoryUsedMb: executionResult.memoryUsedMb,
            testResults: executionResult.testResults,
            isSubmission,
          },
          select: { id: true },
        });

        executionId = created?.id ?? null;
      }
    } catch (e) {
      console.warn("[Code Execution] Skipped saving codeExecution:", (e as any)?.message ?? e);
    }

    // Si es submission: marca AttemptAnswer como respondida (sin usar campos inexistentes como codeSubmission)
    if (isSubmission) {
      // Upsert mínimo: solo selectedOptions (tu schema lo requiere)
      await prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: {
          attemptId,
          questionId,
          selectedOptions: ["__CODE_SUBMITTED__"], // sentinel para UI/submit
        },
        update: {
          selectedOptions: ["__CODE_SUBMITTED__"],
        },
      });

      // Best-effort: si tu AttemptAnswer SÍ tiene estos campos (en tu schema futuro),
      // intentamos guardarlos sin romper si no existen.
      try {
        await (prisma as any).attemptAnswer.update({
          where: { attemptId_questionId: { attemptId, questionId } },
          data: {
            pointsEarned,
            isCorrect: Boolean(executionResult.success),
            executionResults: executionResult.testResults,
            language,
            // codeSubmission: code, // <- NO existe en tu schema actual (por eso lo quitamos)
          },
        });
      } catch (e) {
        // si esos campos no existen, lo ignoramos
      }
    }

    // Response: no leak de hidden; y en submission no regresamos input/expected/actual
    const responseTestResults =
      executionResult.testResults?.map((tr) => {
        const tc = tcById.get(tr.testCaseId);
        const isHidden = Boolean(tc?.isHidden);

        if (isHidden) {
          return {
            testCaseId: tr.testCaseId,
            passed: tr.passed,
            hidden: true,
            error: truncateText(tr.error, 2000),
            executionTimeMs: tr.executionTimeMs,
          };
        }

        if (isSubmission) {
          return {
            testCaseId: tr.testCaseId,
            passed: tr.passed,
            hidden: false,
            error: truncateText(tr.error, 2000),
            executionTimeMs: tr.executionTimeMs,
          };
        }

        return {
          testCaseId: tr.testCaseId,
          passed: tr.passed,
          hidden: false,
          input: truncateText(tr.input, 2000),
          expectedOutput: truncateText(tr.expectedOutput, 2000),
          actualOutput: truncateText(tr.actualOutput, 2000),
          error: truncateText(tr.error, 2000),
          executionTimeMs: tr.executionTimeMs,
        };
      }) ?? [];

    const passed = executionResult.testResults?.filter((r) => r.passed).length || 0;
    const total = executionResult.testResults?.length || 0;

    return jsonNoStore({
      success: true,
      executionId,
      result: {
        success: executionResult.success,
        status: executionResult.status,
        output: truncateText(executionResult.output, 8000),
        error: truncateText(executionResult.error, 8000),
        executionTimeMs: executionResult.executionTimeMs,
        memoryUsedMb: executionResult.memoryUsedMb,
        testResults: responseTestResults,
        pointsEarned: isSubmission ? pointsEarned : undefined,
        passedTests: passed,
        totalTests: total,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/assessments/code/execute] Error:", error);

    const msg = String(error?.message ?? "Unknown error");
    if (msg.toLowerCase().includes("rate limit")) {
      return jsonNoStore({ error: msg }, 429);
    }

    return jsonNoStore(
      {
        error: "Error al ejecutar el código",
        details: msg,
      },
      500
    );
  }
}
