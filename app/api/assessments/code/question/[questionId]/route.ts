// app/api/assessments/code/question/[questionId]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { judge0Service } from '@/lib/code-execution/judge0-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonNoStore(data: any, status = 200) {
  return NextResponse.json(data, { 
    status, 
    headers: { 'Cache-Control': 'no-store' } 
  });
}

export async function GET(
  request: Request,
  { params }: { params: { questionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return jsonNoStore({ error: 'No autorizado' }, 401);
    }

    const user = session.user as any;
    const { questionId } = params;

    // Get question with test cases
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

    // Candidates can only see public test cases
    const testCases = question.testCases
      .filter(tc => isRecruiter || !tc.isHidden)
      .map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
        points: tc.points,
        orderIndex: tc.orderIndex,
      }));

    // Parse allowed languages
    const allowedLanguages = question.allowedLanguages 
      ? JSON.parse(question.allowedLanguages as any)
      : judge0Service.getSupportedLanguages();

    // Default language
    const defaultLanguage = question.language || allowedLanguages[0] || 'javascript';

    // Get starter code
    const starterCode = question.starterCode || 
      judge0Service.getStarterCode(defaultLanguage);

    return jsonNoStore({
      success: true,
      question: {
        id: question.id,
        text: question.questionText,
        points: question.timesUsed, // NOTA: Parece que tu schema usa timesUsed en lugar de points
        language: defaultLanguage,
        allowedLanguages,
        starterCode,
        // Only show solution to recruiters/creators
        solutionCode: isRecruiter ? question.solutionCode : undefined,
        testCases,
        config: question.codingConfig as any,
      },
    });

  } catch (error) {
    console.error('[GET /api/assessments/code/question] Error:', error);
    return jsonNoStore(
      { 
        error: 'Error al obtener la pregunta',
        details: error instanceof Error ? error.message : 'Unknown error',
      }, 
      500
    );
  }
}