// __tests__/utils/test-helpers.ts
import { vi } from 'vitest';

/**
 * Mock data generators
 */
export const mockData = {
  user: (overrides?: Partial<any>) => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  session: (overrides?: Partial<any>) => ({
    user: mockData.user(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }),

  passwordResetToken: (overrides?: Partial<any>) => ({
    token: 'mock-reset-token-' + Math.random().toString(36),
    email: 'test@example.com',
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  }),
};

/**
 * Request/Response helpers
 */
export const createMockRequest = (
  url: string = 'http://localhost:3000',
  options?: RequestInit & {
    headers?: Record<string, string>;
    json?: any;
  }
): Request => {
  const { json, headers = {}, ...restOptions } = options || {};

  return new Request(url, {
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
    body: json ? JSON.stringify(json) : undefined,
    ...restOptions,
  });
};

export const createMockResponse = (
  data?: any,
  init?: ResponseInit
): Response => {
  return new Response(
    data ? JSON.stringify(data) : null,
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      ...init,
    }
  );
};

/**
 * Async helpers
 */
export const waitFor = (ms: number) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await waitFor(interval);
  }
};

/**
 * Mock function helpers
 */
export const createMockFn = <T extends (...args: any[]) => any>() => {
  return vi.fn<Parameters<T>, ReturnType<T>>();
};

export const mockNextAuthSession = (session: any = null) => {
  return vi.fn().mockResolvedValue(session);
};

/**
 * Rate limit test helpers
 */
export const exhaustRateLimit = async (
  checkFn: (identifier: string) => any,
  identifier: string,
  maxAttempts: number
): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    checkFn(identifier);
  }
};

export const expectRateLimited = (result: any) => {
  expect(result.allowed).toBe(false);
  expect(result.retryAfter).toBeGreaterThan(0);
};

export const expectNotRateLimited = (result: any) => {
  expect(result.allowed).toBe(true);
  expect(result.remaining).toBeGreaterThanOrEqual(0);
};

/**
 * Response validation helpers
 */
export const expectSuccessResponse = async (response: Response) => {
  expect(response.ok).toBe(true);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.data).toBeDefined();
  return body.data;
};

export const expectErrorResponse = async (
  response: Response,
  expectedStatus: number,
  expectedCode?: string
) => {
  expect(response.status).toBe(expectedStatus);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();
  
  if (expectedCode) {
    expect(body.error.code).toBe(expectedCode);
  }
  
  return body.error;
};

export const expectValidationError = async (
  response: Response,
  expectedFields?: string[]
) => {
  const error = await expectErrorResponse(response, 422, 'VALIDATION_ERROR');
  
  if (expectedFields) {
    expect(error.details).toBeDefined();
    const fields = error.details.map((d: any) => d.field);
    expectedFields.forEach(field => {
      expect(fields).toContain(field);
    });
  }
  
  return error;
};

/**
 * Security test helpers
 */
export const sqlInjectionPayloads = [
  "' OR '1'='1",
  "1' OR '1' = '1",
  "admin'--",
  "' OR 1=1--",
  "1'; DROP TABLE users--",
  "' UNION SELECT NULL--",
];

export const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
];

export const testSecurityPayload = (
  fn: (input: string) => any,
  payloads: string[]
) => {
  payloads.forEach(payload => {
    expect(() => fn(payload)).not.toThrow();
    const result = fn(payload);
    // Result should not contain the payload as-is (should be sanitized)
    if (typeof result === 'string') {
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('javascript:');
    }
  });
};

/**
 * Performance test helpers
 */
export const measurePerformance = async <T>(
  fn: () => Promise<T> | T,
  iterations: number = 1
): Promise<{ result: T; averageTime: number; totalTime: number }> => {
  const times: number[] = [];
  let lastResult: T;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    lastResult = await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const averageTime = totalTime / iterations;

  return {
    result: lastResult!,
    averageTime,
    totalTime,
  };
};

export const expectPerformance = async (
  fn: () => Promise<any> | any,
  maxTimeMs: number,
  iterations: number = 100
) => {
  const { averageTime } = await measurePerformance(fn, iterations);
  expect(averageTime).toBeLessThan(maxTimeMs);
};

/**
 * Database test helpers (for integration tests)
 */
export const createTestDatabase = () => {
  // Mock in-memory database for testing
  const store = new Map();

  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: any) => store.set(key, value),
    delete: (key: string) => store.delete(key),
    clear: () => store.clear(),
    has: (key: string) => store.has(key),
    size: () => store.size,
  };
};

/**
 * Email validation helper
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate test data
 */
export const generateTestData = {
  email: (prefix = 'test') => 
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
  
  ip: () => 
    `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  
  uuid: () => 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }),
  
  token: (length = 32) => 
    Array.from({ length }, () => 
      Math.random().toString(36).charAt(2)
    ).join(''),
  
  password: () => 
    `Test${Math.random().toString(36).substring(2, 10)}!123`,
};

/**
 * Cleanup helpers
 */
export const cleanupTestData = {
  rateLimits: new Set<string>(),
  
  trackRateLimit: (identifier: string) => {
    cleanupTestData.rateLimits.add(identifier);
  },
  
  clearAll: () => {
    cleanupTestData.rateLimits.clear();
  },
};