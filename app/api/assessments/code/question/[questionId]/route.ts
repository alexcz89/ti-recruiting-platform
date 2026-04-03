// app/api/assessments/code/question/[questionId]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { judge0Service } from '@/lib/code-execution/judge0-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function parseAllowedLanguages(raw: unknown): string[] {
  if (!raw) return judge0Service.getSupportedLanguages();

  if (Array.isArray(raw)) {
    return raw.filter((lang): lang is string => typeof lang === 'string' && lang.trim().length > 0);
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const languages = parsed.filter(
          (lang): lang is string => typeof lang === 'string' && lang.trim().length > 0
        );
        return languages.length > 0 ? languages : judge0Service.getSupportedLanguages();
      }
    } catch {
      return judge0Service.getSupportedLanguages();
    }
  }

  return judge0Service.getSupportedLanguages();
}

export async function GET(
  _request: Request,
  { params }: { params: { questionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return jsonNoStore({ error: 'No autorizado' }, 401);
    }

    const user = session.user as { role?: string } | undefined;
    const questionId = params?.questionId;

    if (!questionId || typeof questionId !== 'string') {
      return jsonNoStore({ error: 'questionId inválido' }, 400);
    }

    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      include: {
        template: {
          select: {
            id: true,
            title: true,
          },
        },
        testCases: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!question) {
      return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);
    }

    if (question.type !== 'CODING') {
      return jsonNoStore({ error: 'Esta pregunta no es de tipo CODING' }, 400);
    }

    const role = String(user?.role ?? '').toUpperCase();
    const isRecruiter = role === 'RECRUITER' || role === 'ADMIN';

    const visibleTestCases = question.testCases
      .filter((tc) => isRecruiter || !tc.isHidden)
      .map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        points: tc.points,
        orderIndex: tc.orderIndex,
      }));

    const allowedLanguages = parseAllowedLanguages(question.allowedLanguages);
    const defaultLanguage =
      (typeof question.language === 'string' && question.language.trim().length > 0
        ? question.language
        : allowedLanguages[0]) || 'javascript';

    const starterCode =
      (typeof question.starterCode === 'string' && question.starterCode.length > 0
        ? question.starterCode
        : judge0Service.getStarterCode(defaultLanguage));

    return jsonNoStore({
      success: true,
      question: {
        id: question.id,
        template: question.template,
        text: question.questionText,
        points: typeof (question as any).points === 'number' ? (question as any).points : 0,
        language: defaultLanguage,
        allowedLanguages,
        starterCode,
        solutionCode: isRecruiter ? question.solutionCode : undefined,
        testCases: visibleTestCases,
        config: question.codingConfig ?? null,
      },
    });
  } catch (error) {
    console.error('[GET /api/assessments/code/question/[questionId]] Error:', error);

    return jsonNoStore(
      {
        error: 'Error al obtener la pregunta',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}