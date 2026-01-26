// vitest.setup.ts - Minimalista (sin React Testing Library)
import { expect, afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables (without trying to reassign read-only properties)
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: false,
  });
}

// Custom matchers
expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Extend TypeScript types
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidEmail(): T;
    toBeWithinRange(floor: number, ceiling: number): T;
  }
}

// Global test utilities
global.testUtils = {
  generateEmail: (prefix = 'test') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}@test.com`;
  },

  generateIp: () => {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  },

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

declare global {
  var testUtils: {
    generateEmail: (prefix?: string) => string;
    generateIp: () => string;
    wait: (ms: number) => Promise<void>;
  };
}

// Suppress console errors in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    error: vi.fn(),
    warn: vi.fn(),
  };
}

// Set timezone for consistent date testing
process.env.TZ = 'UTC';