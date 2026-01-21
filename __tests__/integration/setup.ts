// __tests__/integration/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Test data factories
export const testData = {
  user: {
    admin: {
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'ADMIN' as const,
      emailVerified: new Date(),
    },
    recruiter: {
      id: 'recruiter-1',
      email: 'recruiter@test.com',
      name: 'Recruiter User',
      role: 'RECRUITER' as const,
      emailVerified: new Date(),
      companyId: 'company-1',
    },
    candidate: {
      id: 'candidate-1',
      email: 'candidate@test.com',
      name: 'Candidate User',
      role: 'CANDIDATE' as const,
      emailVerified: new Date(),
    },
    unverified: {
      id: 'unverified-1',
      email: 'unverified@test.com',
      name: 'Unverified User',
      role: 'CANDIDATE' as const,
      emailVerified: null,
    },
  },
  company: {
    default: {
      id: 'company-1',
      name: 'Test Company',
      slug: 'test-company',
      description: 'A test company',
      website: 'https://test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  job: {
    active: {
      id: 'job-1',
      title: 'Senior Developer',
      description: 'Looking for a senior developer',
      location: 'Mexico City',
      locationType: 'HYBRID' as const,
      employmentType: 'FULL_TIME' as const,
      salaryMin: 50000,
      salaryMax: 80000,
      status: 'ACTIVE' as const,
      companyId: 'company-1',
      recruiterId: 'recruiter-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    draft: {
      id: 'job-2',
      title: 'Junior Developer',
      description: 'Entry level position',
      location: 'Remote',
      locationType: 'REMOTE' as const,
      employmentType: 'FULL_TIME' as const,
      salaryMin: 30000,
      salaryMax: 45000,
      status: 'DRAFT' as const,
      companyId: 'company-1',
      recruiterId: 'recruiter-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  application: {
    pending: {
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      status: 'PENDING' as const,
      interest: 'INTERESTED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    accepted: {
      id: 'app-2',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      status: 'ACCEPTED' as const,
      interest: 'VERY_INTERESTED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  assessment: {
    template: {
      id: 'template-1',
      title: 'Technical Assessment',
      description: 'Test technical skills',
      duration: 60,
      passingScore: 70,
      isActive: true,
      createdById: 'recruiter-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    attempt: {
      id: 'attempt-1',
      templateId: 'template-1',
      candidateId: 'candidate-1',
      applicationId: 'app-1',
      status: 'IN_PROGRESS' as const,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
};

// Helper to create mock request with headers
export const createMockRequest = (options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
}) => {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    headers = {},
    searchParams = {},
  } = options;

  const urlObj = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(urlObj.toString(), requestInit);
};

// Helper to create mock session
export const createMockSession = (user: typeof testData.user[keyof typeof testData.user] | null) => {
  if (!user) return null;
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

// Helper to extract JSON from Response
export const getResponseJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Helper to assert response structure
export const assertApiSuccess = (body: any) => {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');
  return body.data;
};

export const assertApiError = (body: any) => {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('message');
  expect(body.error).toHaveProperty('code');
  return body.error;
};