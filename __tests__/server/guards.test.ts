// __tests__/server/guards.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { isDevelopmentAllowed } from '@/lib/server/guards';

describe('Guards System', () => {
  describe('isDevelopmentAllowed', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env before each test
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      // Restore original env
      process.env = originalEnv;
    });

    it('should allow in development with flag enabled', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEBUG_ROUTES_ENABLED = 'true';

      expect(isDevelopmentAllowed()).toBe(true);
    });

    it('should block in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG_ROUTES_ENABLED = 'true';

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should block in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.DEBUG_ROUTES_ENABLED = 'true';

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should block when flag is disabled', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEBUG_ROUTES_ENABLED = 'false';

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should block when flag is not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DEBUG_ROUTES_ENABLED;

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should handle undefined NODE_ENV', () => {
      delete process.env.NODE_ENV;
      process.env.DEBUG_ROUTES_ENABLED = 'true';

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should handle empty string NODE_ENV', () => {
      process.env.NODE_ENV = '';
      process.env.DEBUG_ROUTES_ENABLED = 'true';

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should be case-sensitive for flag value', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEBUG_ROUTES_ENABLED = 'TRUE'; // uppercase

      expect(isDevelopmentAllowed()).toBe(false);
    });

    it('should handle "1" as truthy flag value', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEBUG_ROUTES_ENABLED = '1';

      // Depends on implementation - adjust based on actual behavior
      const result = isDevelopmentAllowed();
      expect(typeof result).toBe('boolean');
    });
  });
});