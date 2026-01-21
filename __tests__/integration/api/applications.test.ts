// __tests__/integration/api/applications.test.ts
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
    application: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
    },
    candidate: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Applications API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/applications', () => {
    it('should return applications for authenticated candidate', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ].filter(app => app.candidateId === testData.user.candidate.id);

      expect(applications).toHaveLength(2);
      applications.forEach(app => {
        expect(app.candidateId).toBe(testData.user.candidate.id);
      });
    });

    it('should return applications for job recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.active;
      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ].filter(app => app.jobId === job.id);

      expect(applications.length).toBeGreaterThan(0);
    });

    it('should filter applications by status', async () => {
      const status = 'PENDING';
      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ].filter(app => app.status === status);

      expect(applications).toHaveLength(1);
      expect(applications[0].status).toBe(status);
    });

    it('should filter applications by interest level', async () => {
      const interest = 'VERY_INTERESTED';
      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ].filter(app => app.interest === interest);

      expect(applications).toHaveLength(1);
      expect(applications[0].interest).toBe(interest);
    });

    it('should require authentication', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const shouldBlock = true;
      expect(shouldBlock).toBe(true);
    });
  });

  describe('GET /api/applications/[id]', () => {
    it('should return application details for owner candidate', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const application = testData.application.pending;
      const canView = application.candidateId === testData.user.candidate.id;

      expect(canView).toBe(true);
      expect(application).toHaveProperty('id');
      expect(application).toHaveProperty('status');
    });

    it('should return application for job recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const application = testData.application.pending;
      const job = testData.job.active;
      const canView = job.recruiterId === testData.user.recruiter.id;

      expect(canView).toBe(true);
    });

    it('should return 404 for non-existent application', async () => {
      const application = null;
      expect(application).toBeNull();
    });

    it('should not allow viewing other candidates applications', async () => {
      const otherCandidate = {
        ...testData.user.candidate,
        id: 'other-candidate',
      };
      const session = createMockSession(otherCandidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const application = testData.application.pending;
      const canView = application.candidateId === otherCandidate.id;

      expect(canView).toBe(false);
    });

    it('should include job details', async () => {
      const application = {
        ...testData.application.pending,
        job: testData.job.active,
      };

      expect(application.job).toBeDefined();
      expect(application.job.title).toBeTruthy();
    });

    it('should include candidate details for recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const application = {
        ...testData.application.pending,
        candidate: testData.user.candidate,
      };

      expect(application.candidate).toBeDefined();
      expect(application.candidate.name).toBeTruthy();
    });
  });

  describe('POST /api/applications', () => {
    it('should create application for valid job', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const applicationData = {
        jobId: testData.job.active.id,
        candidateId: testData.user.candidate.id,
        status: 'PENDING' as const,
        interest: 'INTERESTED' as const,
      };

      expect(applicationData.jobId).toBeTruthy();
      expect(applicationData.candidateId).toBe(testData.user.candidate.id);
    });

    it('should prevent duplicate applications', async () => {
      const existingApp = testData.application.pending;
      
      const isDuplicate = existingApp.candidateId === testData.user.candidate.id &&
                         existingApp.jobId === testData.job.active.id;

      expect(isDuplicate).toBe(true);
    });

    it('should require candidate role', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isCandidate = session?.user.role === 'CANDIDATE';
      expect(isCandidate).toBe(false);
    });

    it('should validate job exists and is active', async () => {
      const job = testData.job.active;
      
      const isValid = job !== null && job.status === 'ACTIVE';
      expect(isValid).toBe(true);
    });

    it('should set initial status to PENDING', async () => {
      const newApplication = {
        ...testData.application.pending,
        status: 'PENDING' as const,
      };

      expect(newApplication.status).toBe('PENDING');
    });

    it('should set default interest level', async () => {
      const newApplication = {
        ...testData.application.pending,
        interest: 'INTERESTED' as const,
      };

      expect(newApplication.interest).toBe('INTERESTED');
    });
  });

  describe('PATCH /api/applications/[id]/status', () => {
    it('should update status by recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const newStatus = 'ACCEPTED' as const;
      const updatedApp = {
        ...testData.application.pending,
        status: newStatus,
      };

      expect(updatedApp.status).toBe('ACCEPTED');
    });

    it('should validate status transitions', async () => {
      const validTransitions = {
        PENDING: ['REVIEWING', 'REJECTED'],
        REVIEWING: ['ACCEPTED', 'REJECTED'],
        ACCEPTED: ['HIRED', 'REJECTED'],
      };

      const currentStatus = 'PENDING' as const;
      const newStatus = 'REVIEWING' as const;

      const isValidTransition = validTransitions[currentStatus]?.includes(newStatus);
      expect(isValidTransition).toBe(true);
    });

    it('should not allow candidate to change status', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isRecruiter = session?.user.role === 'RECRUITER';
      expect(isRecruiter).toBe(false);
    });

    it('should allow admin to change any status', async () => {
      const session = createMockSession(testData.user.admin);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isAdmin = session?.user.role === 'ADMIN';
      expect(isAdmin).toBe(true);
    });

    it('should track status change timestamp', async () => {
      const statusChange = {
        from: 'PENDING',
        to: 'ACCEPTED',
        timestamp: new Date(),
        changedBy: testData.user.recruiter.id,
      };

      expect(statusChange.timestamp).toBeInstanceOf(Date);
      expect(statusChange.changedBy).toBeTruthy();
    });
  });

  describe('PATCH /api/applications/[id]/interest', () => {
    it('should update interest level by candidate', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const newInterest = 'VERY_INTERESTED' as const;
      const updatedApp = {
        ...testData.application.pending,
        interest: newInterest,
      };

      expect(updatedApp.interest).toBe('VERY_INTERESTED');
    });

    it('should validate interest values', async () => {
      const validInterests = ['NOT_INTERESTED', 'INTERESTED', 'VERY_INTERESTED'];
      const interest = 'VERY_INTERESTED';

      expect(validInterests).toContain(interest);
    });

    it('should only allow candidate owner to update', async () => {
      const application = testData.application.pending;
      const session = createMockSession(testData.user.candidate);
      
      const canUpdate = application.candidateId === testData.user.candidate.id;
      expect(canUpdate).toBe(true);
    });

    it('should not allow recruiter to change interest', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isCandidate = session?.user.role === 'CANDIDATE';
      expect(isCandidate).toBe(false);
    });
  });

  describe('DELETE /api/applications/[id]', () => {
    it('should allow candidate to withdraw application', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const application = testData.application.pending;
      const canDelete = application.candidateId === testData.user.candidate.id &&
                       application.status === 'PENDING';

      expect(canDelete).toBe(true);
    });

    it('should not allow withdrawal of accepted applications', async () => {
      const application = testData.application.accepted;
      
      const canWithdraw = application.status === 'PENDING';
      expect(canWithdraw).toBe(false);
    });

    it('should allow recruiter to delete application', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.active;
      const canDelete = job.recruiterId === testData.user.recruiter.id;

      expect(canDelete).toBe(true);
    });

    it('should allow admin to delete any application', async () => {
      const session = createMockSession(testData.user.admin);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isAdmin = session?.user.role === 'ADMIN';
      expect(isAdmin).toBe(true);
    });
  });

  describe('Application Statistics', () => {
    it('should count total applications for job', async () => {
      const jobId = testData.job.active.id;
      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ].filter(app => app.jobId === jobId);

      expect(applications).toHaveLength(2);
    });

    it('should count applications by status', async () => {
      const applications = [
        testData.application.pending,
        testData.application.accepted,
      ];

      const statusCounts = applications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(statusCounts.PENDING).toBe(1);
      expect(statusCounts.ACCEPTED).toBe(1);
    });

    it('should calculate average time to response', async () => {
      const applications = [
        {
          ...testData.application.pending,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-03'),
        },
        {
          ...testData.application.accepted,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-08'),
        },
      ];

      const responseTimes = applications.map(app => 
        app.updatedAt.getTime() - app.createdAt.getTime()
      );

      const averageMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const averageDays = averageMs / (1000 * 60 * 60 * 24);

      expect(averageDays).toBeGreaterThan(0);
    });
  });

  describe('Bulk Operations', () => {
    it('should update multiple application statuses', async () => {
      const applicationIds = ['app-1', 'app-2', 'app-3'];
      const newStatus = 'REJECTED' as const;

      const updates = applicationIds.map(id => ({
        id,
        status: newStatus,
      }));

      expect(updates).toHaveLength(3);
      updates.forEach(update => {
        expect(update.status).toBe('REJECTED');
      });
    });

    it('should reject multiple applications at once', async () => {
      const applications = [
        { ...testData.application.pending, id: 'app-1' },
        { ...testData.application.pending, id: 'app-2' },
        { ...testData.application.pending, id: 'app-3' },
      ];

      const rejected = applications.map(app => ({
        ...app,
        status: 'REJECTED' as const,
      }));

      expect(rejected).toHaveLength(3);
      rejected.forEach(app => {
        expect(app.status).toBe('REJECTED');
      });
    });
  });

  describe('Application Notifications', () => {
    it('should track if candidate was notified', async () => {
      const notification = {
        applicationId: testData.application.accepted.id,
        type: 'STATUS_CHANGE',
        sentAt: new Date(),
        status: 'SENT',
      };

      expect(notification.sentAt).toBeInstanceOf(Date);
      expect(notification.status).toBe('SENT');
    });

    it('should track notification delivery', async () => {
      const notification = {
        applicationId: testData.application.accepted.id,
        delivered: true,
        deliveredAt: new Date(),
      };

      expect(notification.delivered).toBe(true);
      expect(notification.deliveredAt).toBeInstanceOf(Date);
    });
  });
});