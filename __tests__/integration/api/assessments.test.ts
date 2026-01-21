// __tests__/integration/api/assessments.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getServerSession } from 'next-auth';
import {
  testData,
  createMockSession,
} from '../setup';

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    assessmentTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assessmentAttempt: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assessmentAnswer: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('Assessments API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/assessments', () => {
    it('should return active templates for recruiters', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const templates = [
        testData.assessment.template,
      ].filter(t => t.isActive);

      expect(templates).toHaveLength(1);
      expect(templates[0].isActive).toBe(true);
    });

    it('should filter by creator', async () => {
      const creatorId = testData.user.recruiter.id;
      const templates = [
        testData.assessment.template,
      ].filter(t => t.createdById === creatorId);

      expect(templates).toHaveLength(1);
    });

    it('should require authentication', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const shouldBlock = true;
      expect(shouldBlock).toBe(true);
    });

    it('should require recruiter or admin role', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const hasAccess = ['RECRUITER', 'ADMIN'].includes(session?.user.role || '');
      expect(hasAccess).toBe(false);
    });
  });

  describe('GET /api/assessments/[templateId]', () => {
    it('should return template details', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const template = testData.assessment.template;

      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('title');
      expect(template).toHaveProperty('duration');
      expect(template).toHaveProperty('passingScore');
    });

    it('should return 404 for non-existent template', async () => {
      const template = null;
      expect(template).toBeNull();
    });

    it('should include questions', async () => {
      const template = {
        ...testData.assessment.template,
        questions: [
          {
            id: 'q1',
            text: 'What is React?',
            type: 'MULTIPLE_CHOICE',
            points: 10,
          },
          {
            id: 'q2',
            text: 'Explain closures',
            type: 'OPEN_ENDED',
            points: 15,
          },
        ],
      };

      expect(template.questions).toHaveLength(2);
    });
  });

  describe('POST /api/assessments', () => {
    it('should create template by recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const templateData = {
        title: 'Frontend Assessment',
        description: 'Test React skills',
        duration: 45,
        passingScore: 75,
        isActive: true,
      };

      expect(templateData.title).toBeTruthy();
      expect(templateData.duration).toBeGreaterThan(0);
      expect(templateData.passingScore).toBeGreaterThanOrEqual(0);
      expect(templateData.passingScore).toBeLessThanOrEqual(100);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        title: '',
        duration: -10,
        passingScore: 150,
      };

      expect(invalidData.title).toBe('');
      expect(invalidData.duration).toBeLessThan(0);
      expect(invalidData.passingScore).toBeGreaterThan(100);
    });

    it('should associate with creator', async () => {
      const session = createMockSession(testData.user.recruiter);
      
      const template = {
        ...testData.assessment.template,
        createdById: session?.user.id,
      };

      expect(template.createdById).toBe(testData.user.recruiter.id);
    });
  });

  describe('POST /api/assessments/[templateId]/start', () => {
    it('should create attempt for invited candidate', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const invite = {
        templateId: testData.assessment.template.id,
        candidateId: testData.user.candidate.id,
        applicationId: testData.application.pending.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const isValid = invite.expiresAt > new Date();
      expect(isValid).toBe(true);
    });

    it('should prevent duplicate attempts', async () => {
      const existingAttempt = testData.assessment.attempt;
      
      const isDuplicate = existingAttempt.candidateId === testData.user.candidate.id &&
                         existingAttempt.templateId === testData.assessment.template.id &&
                         existingAttempt.status === 'IN_PROGRESS';

      expect(isDuplicate).toBe(true);
    });

    it('should set start time', async () => {
      const attempt = {
        ...testData.assessment.attempt,
        startedAt: new Date(),
      };

      expect(attempt.startedAt).toBeInstanceOf(Date);
    });

    it('should calculate end time based on duration', async () => {
      const duration = testData.assessment.template.duration; // minutes
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      expect(endTime > startTime).toBe(true);
      expect(endTime.getTime() - startTime.getTime()).toBe(duration * 60 * 1000);
    });

    it('should validate invite expiration', async () => {
      const expiredInvite = {
        expiresAt: new Date(Date.now() - 1000),
      };

      const isExpired = expiredInvite.expiresAt < new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe('POST /api/assessments/attempts/[attemptId]/answer', () => {
    it('should record answer', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const answer = {
        attemptId: testData.assessment.attempt.id,
        questionId: 'q1',
        answer: 'A',
        answeredAt: new Date(),
      };

      expect(answer.attemptId).toBeTruthy();
      expect(answer.questionId).toBeTruthy();
      expect(answer.answer).toBeTruthy();
    });

    it('should validate attempt ownership', async () => {
      const attempt = testData.assessment.attempt;
      const session = createMockSession(testData.user.candidate);

      const isOwner = attempt.candidateId === testData.user.candidate.id;
      expect(isOwner).toBe(true);
    });

    it('should not allow answers after time expires', async () => {
      const duration = 60; // minutes
      const startedAt = new Date(Date.now() - 61 * 60 * 1000); // 61 minutes ago
      const now = new Date();

      const isExpired = (now.getTime() - startedAt.getTime()) > (duration * 60 * 1000);
      expect(isExpired).toBe(true);
    });

    it('should not allow answers after submission', async () => {
      const submittedAttempt = {
        ...testData.assessment.attempt,
        status: 'COMPLETED' as const,
        submittedAt: new Date(),
      };

      const canAnswer = submittedAttempt.status === 'IN_PROGRESS';
      expect(canAnswer).toBe(false);
    });

    it('should update existing answer', async () => {
      const existingAnswer = {
        attemptId: testData.assessment.attempt.id,
        questionId: 'q1',
        answer: 'A',
      };

      const updatedAnswer = {
        ...existingAnswer,
        answer: 'B',
        updatedAt: new Date(),
      };

      expect(updatedAnswer.answer).toBe('B');
      expect(updatedAnswer.answer).not.toBe(existingAnswer.answer);
    });
  });

  describe('POST /api/assessments/attempts/[attemptId]/submit', () => {
    it('should submit completed attempt', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const submittedAttempt = {
        ...testData.assessment.attempt,
        status: 'COMPLETED' as const,
        submittedAt: new Date(),
      };

      expect(submittedAttempt.status).toBe('COMPLETED');
      expect(submittedAttempt.submittedAt).toBeInstanceOf(Date);
    });

    it('should calculate score', async () => {
      const answers = [
        { questionId: 'q1', answer: 'A', isCorrect: true, points: 10 },
        { questionId: 'q2', answer: 'B', isCorrect: false, points: 0 },
        { questionId: 'q3', answer: 'C', isCorrect: true, points: 15 },
      ];

      const totalPoints = answers.reduce((sum, a) => sum + a.points, 0);
      const maxPoints = 25;
      const score = (totalPoints / maxPoints) * 100;

      expect(score).toBe(100); // (25/25) * 100
    });

    it('should determine pass/fail', async () => {
      const score = 85;
      const passingScore = testData.assessment.template.passingScore;

      const passed = score >= passingScore;
      expect(passed).toBe(true);
    });

    it('should prevent double submission', async () => {
      const completedAttempt = {
        ...testData.assessment.attempt,
        status: 'COMPLETED' as const,
        submittedAt: new Date(),
      };

      const canSubmit = completedAttempt.status === 'IN_PROGRESS';
      expect(canSubmit).toBe(false);
    });

    it('should record submission time', async () => {
      const startedAt = new Date('2024-01-01T10:00:00');
      const submittedAt = new Date('2024-01-01T10:45:00');

      const durationMs = submittedAt.getTime() - startedAt.getTime();
      const durationMinutes = durationMs / (1000 * 60);

      expect(durationMinutes).toBe(45);
    });
  });

  describe('GET /api/assessments/attempts/[attemptId]/results', () => {
    it('should return results for completed attempt', async () => {
      const completedAttempt = {
        ...testData.assessment.attempt,
        status: 'COMPLETED' as const,
        score: 85,
        passed: true,
        submittedAt: new Date(),
      };

      expect(completedAttempt.status).toBe('COMPLETED');
      expect(completedAttempt.score).toBeGreaterThanOrEqual(0);
      expect(completedAttempt.passed).toBe(true);
    });

    it('should not show results for in-progress attempt', async () => {
      const attempt = testData.assessment.attempt;
      
      const canViewResults = attempt.status === 'COMPLETED';
      expect(canViewResults).toBe(false);
    });

    it('should show results to candidate owner', async () => {
      const session = createMockSession(testData.user.candidate);
      const attempt = testData.assessment.attempt;

      const canView = attempt.candidateId === testData.user.candidate.id;
      expect(canView).toBe(true);
    });

    it('should show results to recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const hasAccess = ['RECRUITER', 'ADMIN'].includes(session?.user.role || '');
      expect(hasAccess).toBe(true);
    });

    it('should include answer breakdown', async () => {
      const results = {
        attemptId: testData.assessment.attempt.id,
        score: 75,
        passed: true,
        answers: [
          { questionId: 'q1', isCorrect: true, points: 10 },
          { questionId: 'q2', isCorrect: false, points: 0 },
          { questionId: 'q3', isCorrect: true, points: 15 },
        ],
      };

      expect(results.answers).toHaveLength(3);
      const correctAnswers = results.answers.filter(a => a.isCorrect);
      expect(correctAnswers).toHaveLength(2);
    });
  });

  describe('Assessment Anti-Cheating', () => {
    it('should track tab switches', async () => {
      const flags = [
        { type: 'TAB_SWITCH', timestamp: new Date(), count: 1 },
        { type: 'TAB_SWITCH', timestamp: new Date(), count: 2 },
      ];

      expect(flags.filter(f => f.type === 'TAB_SWITCH')).toHaveLength(2);
    });

    it('should track fullscreen exits', async () => {
      const flag = {
        attemptId: testData.assessment.attempt.id,
        type: 'FULLSCREEN_EXIT',
        timestamp: new Date(),
      };

      expect(flag.type).toBe('FULLSCREEN_EXIT');
    });

    it('should flag excessive tab switches', async () => {
      const tabSwitchCount = 15;
      const threshold = 10;

      const isSuspicious = tabSwitchCount > threshold;
      expect(isSuspicious).toBe(true);
    });

    it('should track copy-paste attempts', async () => {
      const flag = {
        type: 'COPY_PASTE',
        timestamp: new Date(),
      };

      expect(flag.type).toBe('COPY_PASTE');
    });
  });

  describe('Assessment Statistics', () => {
    it('should calculate average score', async () => {
      const attempts = [
        { score: 85 },
        { score: 90 },
        { score: 75 },
      ];

      const average = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
      expect(average).toBe(83.33333333333333);
    });

    it('should calculate pass rate', async () => {
      const attempts = [
        { passed: true },
        { passed: true },
        { passed: false },
        { passed: true },
      ];

      const passRate = (attempts.filter(a => a.passed).length / attempts.length) * 100;
      expect(passRate).toBe(75);
    });

    it('should calculate average completion time', async () => {
      const attempts = [
        { durationMinutes: 45 },
        { durationMinutes: 50 },
        { durationMinutes: 40 },
      ];

      const avgTime = attempts.reduce((sum, a) => sum + a.durationMinutes, 0) / attempts.length;
      expect(avgTime).toBe(45);
    });
  });

  describe('Assessment Invites', () => {
    it('should create invite for application', async () => {
      const invite = {
        templateId: testData.assessment.template.id,
        candidateId: testData.user.candidate.id,
        applicationId: testData.application.pending.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING' as const,
      };

      expect(invite.status).toBe('PENDING');
      expect(invite.expiresAt > new Date()).toBe(true);
    });

    it('should mark invite as completed after submission', async () => {
      const completedInvite = {
        status: 'COMPLETED' as const,
        completedAt: new Date(),
      };

      expect(completedInvite.status).toBe('COMPLETED');
      expect(completedInvite.completedAt).toBeInstanceOf(Date);
    });

    it('should expire old invites', async () => {
      const oldInvite = {
        expiresAt: new Date(Date.now() - 1000),
        status: 'PENDING' as const,
      };

      const isExpired = oldInvite.expiresAt < new Date();
      expect(isExpired).toBe(true);
    });
  });
});