// app/api/assessments/code/execute/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
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

type DbTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  timeoutMs: number;
  memoryLimitMb: number;
  orderIndex: number;
};

type SafeExecutionTestResult = {
  testCaseId: string;
  passed: boolean;
  hidden: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  executionTimeMs?: number | null;
};

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function truncateText(value: unknown, max = 8000): string | undefined {
  if (value == null) return undefined;
  const text = typeof value === "string" ? value : String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function parseStringArrayLoose(value: unknown): string[] | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? cleaned : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((item) => String(item).trim()).filter(Boolean);
        return cleaned.length ? cleaned : null;
      }
      return null;
    } catch {
      if (value.includes(",")) {
        const cleaned = value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        return cleaned.length ? cleaned : null;
      }
      return null;
    }
  }

  return null;
}

async function loadTestCases(args: {
  questionId: string;
  includeHidden: boolean;
}): Promise<DbTestCase[]> {
  return prisma.codeTestCase.findMany({
    where: args.includeHidden
      ? { questionId: args.questionId }
      : { questionId: args.questionId, isHidden: false },
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
}

async function enforceRateLimit(args: {
  candidateId: string;
  attemptId: string;
  questionId: string;
  isSubmission: boolean;
}) {
  const now = Date.now();
  const limits = args.isSubmission
    ? { windowMs: 5 * 60 * 1000, max: 5 }
    : { windowMs: 60 * 1000, max: 20 };

  const since = new Date(now - limits.windowMs);

  try {
    const count = await prisma.codeExecution.count({
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
  } catch (error: any) {
    const message = String(error?.message ?? "");

    if (message.toLowerCase().includes("rate limit")) {
      throw error;
    }

    console.warn("[Code Execution] Rate limit check skipped:", message);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return jsonNoStore({ error: "No autorizado" }, 401);
    }

    const user = session.user as { id?: string; role?: string };
    const role = String(user?.role ?? "").toUpperCase();

    if (role !== "CANDIDATE") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const body = (await request.json()) as Partial<ExecuteCodeRequest>;
    const attemptId = String(body.attemptId ?? "").trim();
    const questionId = String(body.questionId ?? "").trim();
    const code = typeof body.code === "string" ? body.code : "";
    const language = String(body.language ?? "").trim();
    const isSubmission = Boolean(body.isSubmission);

    if (!attemptId || !questionId || !code || !language) {
      return jsonNoStore({ error: "Faltan campos requeridos" }, 400);
    }

    if (!user.id) {
      return jsonNoStore({ error: "Usuario inválido" }, 401);
    }

    if (code.length > 200_000) {
      return jsonNoStore({ error: "Código demasiado largo" }, 400);
    }

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

    if (!attempt) {
      return jsonNoStore({ error: "Intento no encontrado" }, 404);
    }

    if (attempt.candidateId !== user.id) {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

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

    await enforceRateLimit({
      candidateId: user.id,
      attemptId,
      questionId,
      isSubmission,
    });

    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        templateId: true,
        type: true,
        allowedLanguages: true,
      },
    });

    if (!question) {
      return jsonNoStore({ error: "Pregunta no encontrada" }, 404);
    }

    if (String(question.type ?? "").toUpperCase() !== "CODING") {
      return jsonNoStore({ error: "Esta pregunta no es de tipo CODING" }, 400);
    }

    if (question.templateId !== attempt.templateId) {
      return jsonNoStore({ error: "La pregunta no pertenece a este template" }, 400);
    }

    const allowedLanguages = parseStringArrayLoose(question.allowedLanguages);
    if (allowedLanguages && !allowedLanguages.includes(language)) {
      return jsonNoStore(
        {
          error: "Lenguaje no permitido para esta pregunta",
          allowedLanguages,
        },
        400
      );
    }

    const dbTestCases = await loadTestCases({
      questionId,
      includeHidden: isSubmission,
    });

    if (!dbTestCases.length) {
      return jsonNoStore(
        { error: "Esta pregunta no tiene test cases configurados" },
        400
      );
    }

    const testCases = dbTestCases.map((testCase) => ({
      id: testCase.id,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      timeoutMs: testCase.timeoutMs ?? undefined,
      memoryLimitMb: testCase.memoryLimitMb ?? undefined,
    }));

    console.log(
      `[Code Execution] ${isSubmission ? "SUBMIT" : "RUN"} ${language} q=${questionId} attempt=${attemptId}`
    );

    const executionResult = await judge0Service.executeCode({
      code,
      language,
      testCases,
    });

    const testResults = Array.isArray(executionResult.testResults)
      ? executionResult.testResults
      : [];

    const passedTests = testResults.filter((result) => result.passed).length;
    const totalTests = testResults.length;
    const executionResultsJson = JSON.parse(
      JSON.stringify(testResults)
    ) as Prisma.InputJsonValue;

    const testCaseById = new Map(dbTestCases.map((testCase) => [testCase.id, testCase]));

    let pointsEarned = 0;
    for (const testResult of testResults) {
      if (testResult?.passed) {
        const matchedTestCase = testCaseById.get(testResult.testCaseId);
        pointsEarned += matchedTestCase?.points ? Number(matchedTestCase.points) : 0;
      }
    }

    let executionId: string | null = null;

    try {
      const created = await prisma.codeExecution.create({
        data: {
          attemptId,
          questionId,
          candidateId: user.id,
          code,
          language,
          status: executionResult.status,
          output: truncateText(executionResult.output, 12000),
          error: truncateText(executionResult.error, 12000),
          executionTimeMs: executionResult.executionTimeMs,
          memoryUsedMb: executionResult.memoryUsedMb,
          testResults: executionResultsJson,
          isSubmission,
        },
        select: { id: true },
      });

      executionId = created.id;
    } catch (error: any) {
      console.warn(
        "[Code Execution] Failed saving codeExecution:",
        error?.message ?? error
      );
    }

    if (isSubmission) {
      await prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: { attemptId, questionId },
        },
        create: {
          attemptId,
          questionId,
          selectedOptions: ["__CODE_SUBMITTED__"],
          codeSubmission: code,
          language,
          executionResults: executionResultsJson,
          passedTests,
          totalTests,
          pointsEarned,
          isCorrect: Boolean(executionResult.success),
          executionTime: executionResult.executionTimeMs ?? null,
          memoryUsed: executionResult.memoryUsedMb ?? null,
        },
        update: {
          selectedOptions: ["__CODE_SUBMITTED__"],
          codeSubmission: code,
          language,
          executionResults: executionResultsJson,
          passedTests,
          totalTests,
          pointsEarned,
          isCorrect: Boolean(executionResult.success),
          executionTime: executionResult.executionTimeMs ?? null,
          memoryUsed: executionResult.memoryUsedMb ?? null,
        },
      });
    }

    const responseTestResults: SafeExecutionTestResult[] = testResults.map((testResult) => {
      const matchedTestCase = testCaseById.get(testResult.testCaseId);
      const isHidden = Boolean(matchedTestCase?.isHidden);

      if (isHidden) {
        return {
          testCaseId: testResult.testCaseId,
          passed: testResult.passed,
          hidden: true,
          error: truncateText(testResult.error, 2000),
          executionTimeMs: testResult.executionTimeMs,
        };
      }

      if (isSubmission) {
        return {
          testCaseId: testResult.testCaseId,
          passed: testResult.passed,
          hidden: false,
          error: truncateText(testResult.error, 2000),
          executionTimeMs: testResult.executionTimeMs,
        };
      }

      return {
        testCaseId: testResult.testCaseId,
        passed: testResult.passed,
        hidden: false,
        input: truncateText(testResult.input, 2000),
        expectedOutput: truncateText(testResult.expectedOutput, 2000),
        actualOutput: truncateText(testResult.actualOutput, 2000),
        error: truncateText(testResult.error, 2000),
        executionTimeMs: testResult.executionTimeMs,
      };
    });

    return jsonNoStore({
      success: true,
      executionId,
      result: {
        success: Boolean(executionResult.success),
        status: executionResult.status,
        output: truncateText(executionResult.output, 8000),
        error: truncateText(executionResult.error, 8000),
        executionTimeMs: executionResult.executionTimeMs,
        memoryUsedMb: executionResult.memoryUsedMb,
        testResults: responseTestResults,
        pointsEarned: isSubmission ? pointsEarned : undefined,
        passedTests,
        totalTests,
      },
    });
  } catch (error: any) {
    console.error("[POST /api/assessments/code/execute] Error:", error);

    const message = String(error?.message ?? "Unknown error");
    if (message.toLowerCase().includes("rate limit")) {
      return jsonNoStore({ error: message }, 429);
    }

    return jsonNoStore(
      {
        error: "Error al ejecutar el código",
        details: message,
      },
      500
    );
  }
}