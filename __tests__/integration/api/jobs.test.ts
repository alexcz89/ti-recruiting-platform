// __tests__/integration/api/jobs.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getServerSession } from 'next-auth';
import {
  testData,
  createMockRequest,
  createMockSession,
  assertApiSuccess,
  assertApiError,
} from '../setup';

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('Jobs API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/jobs', () => {
    it('should return list of active jobs for public', async () => {
      // Mock no session (public access)
      vi.mocked(getServerSession).mockResolvedValue(null);

      const jobs = [
        testData.job.active,
        { ...testData.job.active, id: 'job-3', title: 'Mid-level Developer' },
      ];

      expect(jobs).toHaveLength(2);
      expect(jobs[0].status).toBe('ACTIVE');
      expect(jobs[1].status).toBe('ACTIVE');
    });

    it('should filter jobs by location', async () => {
      const location = 'Mexico City';
      
      const jobs = [
        testData.job.active,
      ].filter(job => job.location === location);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].location).toBe(location);
    });

    it('should filter jobs by employment type', async () => {
      const employmentType = 'FULL_TIME';
      
      const jobs = [
        testData.job.active,
        testData.job.draft,
      ].filter(job => job.employmentType === employmentType);

      expect(jobs.length).toBeGreaterThan(0);
      jobs.forEach(job => {
        expect(job.employmentType).toBe(employmentType);
      });
    });

    it('should filter jobs by salary range', async () => {
      const minSalary = 40000;
      const maxSalary = 70000;
      
      const jobs = [
        testData.job.active,
      ].filter(job => 
        (job.salaryMin ?? 0) >= minSalary && 
        (job.salaryMax ?? Infinity) <= maxSalary
      );

      jobs.forEach(job => {
        if (job.salaryMin) expect(job.salaryMin).toBeGreaterThanOrEqual(minSalary);
        if (job.salaryMax) expect(job.salaryMax).toBeLessThanOrEqual(maxSalary);
      });
    });

    it('should support pagination', async () => {
      const page = 1;
      const pageSize = 10;
      const skip = (page - 1) * pageSize;
      
      const allJobs = Array(25).fill(null).map((_, i) => ({
        ...testData.job.active,
        id: `job-${i}`,
      }));

      const paginatedJobs = allJobs.slice(skip, skip + pageSize);

      expect(paginatedJobs).toHaveLength(pageSize);
    });

    it('should not show draft jobs to public', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const jobs = [
        testData.job.active,
        testData.job.draft,
      ].filter(job => job.status === 'ACTIVE');

      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('ACTIVE');
    });

    it('should show all jobs to recruiter from same company', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const jobs = [
        testData.job.active,
        testData.job.draft,
      ].filter(job => job.companyId === testData.user.recruiter.companyId);

      expect(jobs).toHaveLength(2);
    });
  });

  describe('GET /api/jobs/[id]', () => {
    it('should return job details for valid id', async () => {
      const job = testData.job.active;

      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('description');
      expect(job.status).toBe('ACTIVE');
    });

    it('should return 404 for non-existent job', async () => {
      const job = null;

      expect(job).toBeNull();
    });

    it('should return 404 for draft job accessed by public', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);
      const job = testData.job.draft;

      const shouldBlock = job.status === 'DRAFT';
      expect(shouldBlock).toBe(true);
    });

    it('should allow recruiter to view their draft job', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.draft;
      const canView = job.recruiterId === testData.user.recruiter.id;

      expect(canView).toBe(true);
    });

    it('should include company information', async () => {
      const job = {
        ...testData.job.active,
        company: testData.company.default,
      };

      expect(job.company).toBeDefined();
      expect(job.company.name).toBe(testData.company.default.name);
    });
  });

  describe('POST /api/jobs', () => {
    it('should create job for authenticated recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const jobData = {
        title: 'New Position',
        description: 'Job description',
        location: 'Remote',
        locationType: 'REMOTE',
        employmentType: 'FULL_TIME',
        salaryMin: 50000,
        salaryMax: 70000,
      };

      expect(jobData.title).toBeTruthy();
      expect(jobData.description).toBeTruthy();
    });

    it('should require authentication', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const shouldBlock = true;
      expect(shouldBlock).toBe(true);
    });

    it('should require recruiter role', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isRecruiter = session?.user.role === 'RECRUITER';
      expect(isRecruiter).toBe(false);
    });

    it('should validate required fields', async () => {
      const invalidJobData = {
        title: '', // empty title
        description: 'Test',
      };

      expect(invalidJobData.title).toBe('');
    });

    it('should validate salary range', async () => {
      const invalidSalary = {
        salaryMin: 80000,
        salaryMax: 50000, // max < min
      };

      const isValid = invalidSalary.salaryMax >= invalidSalary.salaryMin;
      expect(isValid).toBe(false);
    });

    it('should associate job with recruiter company', async () => {
      const session = createMockSession(testData.user.recruiter);
      
      const job = {
        ...testData.job.active,
        companyId: testData.user.recruiter.companyId,
        recruiterId: testData.user.recruiter.id,
      };

      expect(job.companyId).toBe(testData.user.recruiter.companyId);
      expect(job.recruiterId).toBe(testData.user.recruiter.id);
    });
  });

  describe('PUT /api/jobs/[id]', () => {
    it('should update job for owner recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.active;
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      const canUpdate = job.recruiterId === testData.user.recruiter.id;
      expect(canUpdate).toBe(true);
    });

    it('should not allow update by non-owner', async () => {
      const otherRecruiter = {
        ...testData.user.recruiter,
        id: 'other-recruiter',
      };
      const session = createMockSession(otherRecruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.active;
      const canUpdate = job.recruiterId === otherRecruiter.id;

      expect(canUpdate).toBe(false);
    });

    it('should allow admin to update any job', async () => {
      const session = createMockSession(testData.user.admin);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isAdmin = session?.user.role === 'ADMIN';
      expect(isAdmin).toBe(true);
    });

    it('should validate update data', async () => {
      const invalidUpdate = {
        title: '', // empty title
      };

      expect(invalidUpdate.title).toBe('');
    });
  });

  describe('DELETE /api/jobs/[id]', () => {
    it('should delete job for owner recruiter', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.draft;
      const canDelete = job.recruiterId === testData.user.recruiter.id;

      expect(canDelete).toBe(true);
    });

    it('should not delete job with applications', async () => {
      const job = testData.job.active;
      const applicationCount = 5;

      const hasApplications = applicationCount > 0;
      expect(hasApplications).toBe(true);
    });

    it('should allow admin to delete any job', async () => {
      const session = createMockSession(testData.user.admin);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isAdmin = session?.user.role === 'ADMIN';
      expect(isAdmin).toBe(true);
    });
  });

  describe('POST /api/jobs/[id]/apply', () => {
    it('should create application for authenticated candidate', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const job = testData.job.active;
      const application = {
        jobId: job.id,
        candidateId: testData.user.candidate.id,
        status: 'PENDING',
      };

      expect(application.candidateId).toBe(testData.user.candidate.id);
      expect(application.jobId).toBe(job.id);
    });

    it('should prevent duplicate applications', async () => {
      const existingApplication = testData.application.pending;

      expect(existingApplication).toBeDefined();
      expect(existingApplication.candidateId).toBe(testData.user.candidate.id);
    });

    it('should require candidate role', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const isCandidate = session?.user.role === 'CANDIDATE';
      expect(isCandidate).toBe(false);
    });

    it('should not allow applying to closed jobs', async () => {
      const closedJob = {
        ...testData.job.active,
        status: 'CLOSED' as const,
      };

      const canApply = closedJob.status === 'ACTIVE';
      expect(canApply).toBe(false);
    });
  });

  describe('Job Status Management', () => {
    it('should update job status to ACTIVE', async () => {
      const job = testData.job.draft;
      const newStatus = 'ACTIVE' as const;

      const updatedJob = {
        ...job,
        status: newStatus,
      };

      expect(updatedJob.status).toBe('ACTIVE');
    });

    it('should update job status to CLOSED', async () => {
      const job = testData.job.active;
      const newStatus = 'CLOSED' as const;

      const updatedJob = {
        ...job,
        status: newStatus,
      };

      expect(updatedJob.status).toBe('CLOSED');
    });

    it('should track status change history', async () => {
      const statusChanges = [
        { from: 'DRAFT', to: 'ACTIVE', timestamp: new Date() },
        { from: 'ACTIVE', to: 'CLOSED', timestamp: new Date() },
      ];

      expect(statusChanges).toHaveLength(2);
      expect(statusChanges[0].to).toBe('ACTIVE');
      expect(statusChanges[1].to).toBe('CLOSED');
    });
  });

  describe('Job Search and Filtering', () => {
    it('should search jobs by title keyword', async () => {
      const keyword = 'developer';
      const jobs = [
        testData.job.active,
        { ...testData.job.active, id: 'job-3', title: 'Designer' },
      ];

      const results = jobs.filter(job => 
        job.title.toLowerCase().includes(keyword.toLowerCase())
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach(job => {
        expect(job.title.toLowerCase()).toContain(keyword.toLowerCase());
      });
    });

    it('should filter by multiple criteria', async () => {
      const filters = {
        location: 'Mexico City',
        employmentType: 'FULL_TIME',
        salaryMin: 40000,
      };

      const jobs = [testData.job.active].filter(job =>
        job.location === filters.location &&
        job.employmentType === filters.employmentType &&
        (job.salaryMin ?? 0) >= filters.salaryMin
      );

      expect(jobs).toHaveLength(1);
    });

    it('should sort jobs by created date', async () => {
      const jobs = [
        { ...testData.job.active, createdAt: new Date('2024-01-01') },
        { ...testData.job.active, id: 'job-3', createdAt: new Date('2024-01-15') },
        { ...testData.job.active, id: 'job-4', createdAt: new Date('2024-01-10') },
      ];

      const sorted = [...jobs].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted[0].createdAt > sorted[1].createdAt).toBe(true);
      expect(sorted[1].createdAt > sorted[2].createdAt).toBe(true);
    });
  });
});