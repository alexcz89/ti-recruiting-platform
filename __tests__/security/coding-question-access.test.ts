import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  companyId: vi.fn(),
  attempt: vi.fn(),
  question: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/server/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/server/session', () => ({ getSessionCompanyId: mocks.companyId }));
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    assessmentAttempt: { findFirst: mocks.attempt },
    assessmentQuestion: { findFirst: mocks.question },
  },
}));
vi.mock('@/lib/code-execution/judge0-service', () => ({
  judge0Service: {
    getSupportedLanguages: () => ['javascript', 'python'],
    getStarterCode: () => '// starter',
  },
}));

let GET: typeof import('@/app/api/assessments/code/question/[questionId]/route')['GET'];
beforeAll(async () => {
  ({ GET } = await import('@/app/api/assessments/code/question/[questionId]/route'));
});

function attempt() {
  return {
    templateId: 'template-a',
    status: 'IN_PROGRESS',
    expiresAt: new Date(Date.now() + 60_000),
    flagsJson: { questionOrder: ['question-a'] } as Prisma.JsonValue,
    template: { isBadgeExam: false },
    invite: { status: 'STARTED' } as { status: string } | null,
    contestRegistration: null as null | {
      contest: { status: string; challengeOpens: Date; challengeCloses: Date };
    },
  };
}

const question = {
  id: 'question-a',
  template: { id: 'template-a', title: 'Private assessment' },
  questionText: 'Implement solve()',
  language: 'javascript',
  allowedLanguages: '["javascript"]',
  starterCode: 'function solve() {}',
  solutionCode: 'official-secret-solution',
  codingConfig: { privateAnswer: 'config-secret' },
  testCases: [
    { id: 'visible', input: 'solve(1)', expectedOutput: '1', isHidden: false, points: 1, orderIndex: 0 },
    { id: 'hidden', input: 'hidden-secret-input', expectedOutput: 'hidden-secret-output', isHidden: true, points: 1, orderIndex: 1 },
  ],
};

async function request(query = '?attemptId=attempt-a', questionId = 'question-a') {
  const response = await GET(new Request(`http://localhost/api/assessments/code/question/${questionId}${query}`), {
    params: { questionId },
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  return response;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'candidate-a', role: 'CANDIDATE' } });
  mocks.companyId.mockResolvedValue('company-a');
  mocks.attempt.mockResolvedValue(attempt());
  mocks.question.mockResolvedValue(question);
});

describe('coding question authentication and tenant access', () => {
  it('rejects unauthenticated requests before querying data', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(mocks.question).not.toHaveBeenCalled();
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it('rejects sessions without a user id', async () => {
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    expect((await request()).status).toBe(401);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('rejects unsupported roles', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'user-a', role: 'UNKNOWN' } });
    expect((await request()).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('requires an approved recruiter company even when a client supplies one', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'recruiter-a', role: 'RECRUITER', companyId: 'company-b' } });
    mocks.companyId.mockResolvedValue(null);
    expect((await request('?companyId=company-b')).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it.each([
    { scope: 'own company', companyId: 'company-a', isGlobal: false, status: 200 },
    { scope: 'global', companyId: null, isGlobal: true, status: 200 },
    { scope: 'another company', companyId: 'company-b', isGlobal: false, status: 404 },
  ])('enforces recruiter access for $scope templates', async ({ companyId, isGlobal, status }) => {
    mocks.session.mockResolvedValue({ user: { id: 'recruiter-a', role: 'RECRUITER' } });
    mocks.question.mockImplementation(async ({ where }: Prisma.AssessmentQuestionFindFirstArgs) => {
      const visibility = where?.template as Prisma.AssessmentTemplateWhereInput;
      const matches = visibility.OR?.some(branch =>
        (branch.isGlobal === true && isGlobal) || branch.companyId === companyId
      );
      return matches ? question : null;
    });
    const response = await request('?companyId=company-b');
    expect(response.status).toBe(status);
    const body = await response.json();
    if (status === 200) {
      expect(body.question.solutionCode).toBe(question.solutionCode);
      expect(body.question.testCases).toHaveLength(2);
    } else {
      expect(body).toEqual({ error: 'Pregunta no encontrada' });
    }
    expect(mocks.question).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'question-a', type: 'CODING', template: { OR: [{ isGlobal: true }, { companyId: 'company-a' }] } },
    }));
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it('preserves explicit admin access without a company or client tenant authority', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'admin-a', role: 'ADMIN' } });
    const response = await request('?companyId=company-b');
    expect(response.status).toBe(200);
    expect((await response.json()).question.solutionCode).toBe(question.solutionCode);
    expect(mocks.companyId).not.toHaveBeenCalled();
    expect(mocks.question).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'question-a', type: 'CODING', template: {} },
    }));
  });
});

describe('candidate attempt authorization', () => {
  it('requires attempt context, including for global questions', async () => {
    expect((await request('')).status).toBe(404);
    expect(mocks.question).not.toHaveBeenCalled();
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it('does not reveal whether a missing or another candidate attempt exists', async () => {
    mocks.attempt.mockImplementation(async ({ where }: Prisma.AssessmentAttemptFindFirstArgs) =>
      where?.candidateId === 'candidate-b' ? attempt() : null
    );
    const response = await request('?attemptId=someone-elses-attempt');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Pregunta no encontrada' });
    expect(mocks.attempt).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'someone-elses-attempt', candidateId: 'candidate-a' },
    }));
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('restricts question lookup to active coding questions in the authorized template', async () => {
    mocks.question.mockImplementation(async ({ where }: Prisma.AssessmentQuestionFindFirstArgs) =>
      where?.templateId === 'another-template' ? question : null
    );
    expect((await request()).status).toBe(404);
    expect(mocks.question).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'question-a', type: 'CODING', templateId: 'template-a', isActive: true },
    }));
  });

  it.each(['NOT_STARTED', 'SUBMITTED', 'EVALUATED', 'COMPLETED', 'INVALID'])('denies active-question access for state %s', async status => {
    mocks.attempt.mockResolvedValue({ ...attempt(), status });
    expect((await request()).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('denies expired attempts before querying questions', async () => {
    mocks.attempt.mockResolvedValue({ ...attempt(), expiresAt: new Date(Date.now() - 1) });
    const response = await request();
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('ASSESSMENT_EXPIRED');
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('respects invitation cancellation', async () => {
    mocks.attempt.mockResolvedValue({ ...attempt(), invite: { status: 'CANCELLED' } });
    expect((await request()).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('keeps a started attempt usable after the invitation entry deadline', async () => {
    mocks.attempt.mockResolvedValue({
      ...attempt(), invite: { status: 'STARTED', expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await request()).status).toBe(200);
  });

  it.each([
    { questionOrder: ['other-question'] },
    { questionOrder: [] },
    { questionOrder: 'question-a' },
    { questionOrder: ['question-a', 1] },
    { sampled: true },
    'invalid-flags',
  ])('fails closed for an unauthorized or malformed persisted question set: %j', async flagsJson => {
    mocks.attempt.mockResolvedValue({ ...attempt(), flagsJson });
    expect((await request()).status).toBe(404);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('keeps legacy unsampled attempts with no questionOrder usable', async () => {
    mocks.attempt.mockResolvedValue({ ...attempt(), flagsJson: null, expiresAt: null });
    expect((await request()).status).toBe(200);
  });

  it('never returns official solutions, hidden tests or unvalidated configuration', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.question).not.toHaveProperty('solutionCode');
    expect(body.question.config).toBeNull();
    expect(body.question.testCases).toEqual([{
      id: 'visible',
      input: 'solve(1)',
      expectedOutput: '1',
      isHidden: false,
    }]);
    expect(body.question.starterCode).toBe(question.starterCode);
    const serialized = JSON.stringify(body);
    for (const secret of ['official-secret-solution', 'hidden-secret-input', 'hidden-secret-output', 'config-secret']) {
      expect(serialized).not.toContain(secret);
    }
    expect(mocks.question).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        solutionCode: false, codingConfig: false,
        testCases: expect.objectContaining({ where: { isHidden: false } }),
      }),
    }));
  });

  it('preserves sampled badge attempts without an invite or application', async () => {
    mocks.attempt.mockResolvedValue({ ...attempt(), invite: null, template: { isBadgeExam: true }, flagsJson: { sampled: true, questionOrder: ['question-a'] } });
    expect((await request()).status).toBe(200);
  });

  it('never falls back to the full badge pool without a persisted sample', async () => {
    mocks.attempt.mockResolvedValue({ ...attempt(), invite: null, template: { isBadgeExam: true }, flagsJson: null });
    expect((await request()).status).toBe(404);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it.each([true, false])('respects the contest challenge window (open=%s)', async open => {
    mocks.attempt.mockResolvedValue({
      ...attempt(), invite: null,
      contestRegistration: { contest: {
        status: 'REGISTRATION_OPEN',
        challengeOpens: new Date(Date.now() + (open ? -60_000 : 60_000)),
        challengeCloses: new Date(Date.now() + 120_000),
      } },
    });
    expect((await request()).status).toBe(open ? 200 : 403);
    if (!open) expect(mocks.question).not.toHaveBeenCalled();
  });

  it('denies contest access after the challenge closes even if the attempt deadline is later', async () => {
    mocks.attempt.mockResolvedValue({
      ...attempt(), invite: null,
      contestRegistration: { contest: {
        status: 'REGISTRATION_OPEN',
        challengeOpens: new Date(Date.now() - 120_000),
        challengeCloses: new Date(Date.now() - 60_000),
      } },
    });
    expect((await request()).status).toBe(403);
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it('does not expose internal exceptions', async () => {
    mocks.attempt.mockRejectedValue(new Error('postgres://private-credentials'));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Error al obtener la pregunta' });
  });
});
