// app/api/assessments/code/question/[questionId]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { judge0Service } from '@/lib/code-execution/judge0-service';
import type { Prisma } from '@prisma/client';
import { getSessionCompanyId } from '@/lib/server/session';
import { getAssessmentTemplateVisibilityWhere, isAssessmentTemplateAccessRole } from '@/lib/assessments/access';
import { ASSESSMENT_EXPIRED_CODE, isAssessmentExpired } from '@/lib/assessments/expiration';
import { challengeAvailability } from '@/lib/contests/domain';

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
  request: Request,
  { params }: { params: { questionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return jsonNoStore({ error: 'No autorizado' }, 401);
    }

    const user = session.user as { id?: string; role?: string };
    if (!user.id) return jsonNoStore({ error: 'No autorizado' }, 401);
    const role = String(user.role ?? '').toUpperCase();
    const isStaff = isAssessmentTemplateAccessRole(role);
    if (!isStaff && role !== 'CANDIDATE') {
      return jsonNoStore({ error: 'No autorizado' }, 403);
    }
    const questionId = params?.questionId;

    if (!questionId || typeof questionId !== 'string') {
      return jsonNoStore({ error: 'questionId inválido' }, 400);
    }

    const where: Prisma.AssessmentQuestionWhereInput = { id: questionId, type: 'CODING' };
    if (isStaff) {
      const companyId = role === 'RECRUITER' ? await getSessionCompanyId() : null;
      const visibility = getAssessmentTemplateVisibilityWhere({ role, companyId });
      if (!visibility) return jsonNoStore({ error: 'No autorizado' }, 403);
      where.template = visibility;
    } else {
      const attemptId = new URL(request.url).searchParams.get('attemptId')?.trim();
      if (!attemptId) return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);

      const attempt = await prisma.assessmentAttempt.findFirst({
        where: { id: attemptId, candidateId: user.id },
        select: {
          templateId: true, status: true, expiresAt: true, flagsJson: true,
          template: { select: { isBadgeExam: true } },
          invite: { select: { status: true } },
          contestRegistration: {
            select: {
              contest: { select: { status: true, challengeOpens: true, challengeCloses: true } },
            },
          },
        },
      });
      if (!attempt) return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);
      if (attempt.status !== 'IN_PROGRESS' || attempt.invite?.status === 'CANCELLED') {
        return jsonNoStore({ error: 'El intento no está disponible' }, 403);
      }
      if (isAssessmentExpired(attempt.expiresAt)) {
        return jsonNoStore({ error: 'Tiempo expirado', code: ASSESSMENT_EXPIRED_CODE }, 410);
      }
      if (attempt.contestRegistration && !challengeAvailability(attempt.contestRegistration.contest).open) {
        return jsonNoStore({ error: 'El intento no está disponible' }, 403);
      }

      const flags = attempt.flagsJson;
      if (flags !== null && (typeof flags !== 'object' || Array.isArray(flags))) {
        return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);
      }
      const order = flags?.questionOrder;
      // Legacy unsampled attempts may lack an order; badge pools must never fall back to the full template.
      if (order !== undefined
        ? !Array.isArray(order) || !order.every(id => typeof id === 'string') || !order.includes(questionId)
        : attempt.template.isBadgeExam || flags?.sampled === true) {
        return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);
      }
      where.templateId = attempt.templateId;
      where.isActive = true;
    }

    const question = await prisma.assessmentQuestion.findFirst({
      where,
      select: {
        id: true, questionText: true, language: true, allowedLanguages: true, starterCode: true,
        solutionCode: isStaff,
        codingConfig: isStaff,
        template: {
          select: {
            id: true,
            title: true,
          },
        },
        testCases: {
          where: isStaff ? {} : { isHidden: false },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!question) {
      return jsonNoStore({ error: 'Pregunta no encontrada' }, 404);
    }

    const visibleTestCases = isStaff
      ? question.testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          points: tc.points,
          orderIndex: tc.orderIndex,
        }))
      : question.testCases
          .filter((tc) => !tc.isHidden)
          .map((tc) => ({
            id: tc.id,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: false,
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
        points: 0,
        language: defaultLanguage,
        allowedLanguages,
        starterCode,
        solutionCode: isStaff ? question.solutionCode : undefined,
        testCases: visibleTestCases,
        config: isStaff ? question.codingConfig ?? null : null,
      },
    });
  } catch (error) {
    console.error('[GET /api/assessments/code/question/[questionId]] Error:', error);

    return jsonNoStore(
      {
        error: 'Error al obtener la pregunta',
      },
      500
    );
  }
}
