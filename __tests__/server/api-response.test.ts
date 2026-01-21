// __tests__/server/api-response.test.ts - ENHANCED VERSION (90%+ coverage)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  jsonSuccess,
  jsonError,
  jsonOk,
  jsonNoStore,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  internalError,
  serviceUnavailable,
  plainNotFound,
  plainUnauthorized,
  plainForbidden,
  handlePrismaError,
  handleZodError,
  withErrorHandling,
  isApiSuccess,
  isApiError,
  HTTP_STATUS,
  ERROR_CODES,
} from '@/lib/server/api-response';

describe('API Response Helpers - Enhanced Coverage', () => {
  // Spy on console methods
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('jsonSuccess', () => {
    it('should create success response', async () => {
      const data = { user: { id: '123', name: 'John' } };
      const response = jsonSuccess(data);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toContain('no-store');

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should accept custom status', async () => {
      const response = jsonSuccess({ id: '123' }, { status: HTTP_STATUS.CREATED });
      expect(response.status).toBe(HTTP_STATUS.CREATED);
    });

    it('should include timestamp when requested', async () => {
      const response = jsonSuccess({ test: true }, { includeTimestamp: true });
      const body = await response.json();
      
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should accept custom headers', async () => {
      const response = jsonSuccess({ test: true }, {
        headers: { 'X-Custom': 'value' },
      });
      
      expect(response.headers.get('X-Custom')).toBe('value');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should not include timestamp by default', async () => {
      const response = jsonSuccess({ test: true });
      const body = await response.json();
      
      expect(body.timestamp).toBeUndefined();
    });
  });

  describe('jsonOk alias', () => {
    it('should work as alias for jsonSuccess', async () => {
      const data = { test: true };
      const response = jsonOk(data);
      
      expect(response.status).toBe(HTTP_STATUS.OK);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });
  });

  describe('jsonNoStore', () => {
    it('should create no-store response with default status', async () => {
      const data = { jobs: ['job1', 'job2'] };
      const response = jsonNoStore(data);
      
      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should accept custom status', async () => {
      const response = jsonNoStore({ test: true }, HTTP_STATUS.CREATED);
      expect(response.status).toBe(HTTP_STATUS.CREATED);
    });
  });

  describe('jsonError', () => {
    it('should create error response', async () => {
      const response = jsonError('Something went wrong', {
        status: HTTP_STATUS.BAD_REQUEST,
        code: ERROR_CODES.BAD_REQUEST,
      });

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Something went wrong');
      expect(body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('should include details when provided', async () => {
      const details = { field: 'email', issue: 'invalid format' };
      const response = jsonError('Validation failed', { details });
      
      const body = await response.json();
      expect(body.error.details).toEqual(details);
    });

    it('should include timestamp when requested', async () => {
      const response = jsonError('Error', { includeTimestamp: true });
      const body = await response.json();
      
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should log errors for 5xx status codes', async () => {
      jsonError('Server error', {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: ERROR_CODES.INTERNAL_ERROR,
        details: { stack: 'error stack' },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[API_ERROR]',
        expect.objectContaining({
          message: 'Server error',
          status: 500,
        })
      );
    });

    it('should not log errors for 4xx status codes', async () => {
      jsonError('Client error', {
        status: HTTP_STATUS.BAD_REQUEST,
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should accept custom headers', async () => {
      const response = jsonError('Error', {
        headers: { 'X-Error-Id': '123' },
      });
      
      expect(response.headers.get('X-Error-Id')).toBe('123');
    });
  });

  describe('Error helpers', () => {
    it('badRequest should return 400', async () => {
      const response = badRequest('Invalid input');
      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
      expect(body.error.message).toBe('Invalid input');
    });

    it('badRequest should include details', async () => {
      const details = { field: 'email' };
      const response = badRequest('Invalid', details);
      
      const body = await response.json();
      expect(body.error.details).toEqual(details);
    });

    it('badRequest should use default message', async () => {
      const response = badRequest();
      const body = await response.json();
      expect(body.error.message).toBe('Bad request');
    });

    it('unauthorized should return 401', async () => {
      const response = unauthorized();
      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(body.error.message).toBe('Authentication required');
    });

    it('unauthorized should accept custom message', async () => {
      const response = unauthorized('Please login');
      const body = await response.json();
      expect(body.error.message).toBe('Please login');
    });

    it('forbidden should return 403', async () => {
      const response = forbidden('Not allowed');
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(body.error.message).toBe('Not allowed');
    });

    it('forbidden should use default message', async () => {
      const response = forbidden();
      const body = await response.json();
      expect(body.error.message).toBe('Insufficient permissions');
    });

    it('notFound should return 404', async () => {
      const response = notFound('User');
      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      
      const body = await response.json();
      expect(body.error.message).toContain('User not found');
    });

    it('notFound should use default resource name', async () => {
      const response = notFound();
      const body = await response.json();
      expect(body.error.message).toBe('Resource not found');
    });

    it('conflict should return 409', async () => {
      const response = conflict('Email already exists');
      expect(response.status).toBe(HTTP_STATUS.CONFLICT);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.CONFLICT);
      expect(body.error.message).toBe('Email already exists');
    });

    it('conflict should use default message', async () => {
      const response = conflict();
      const body = await response.json();
      expect(body.error.message).toBe('Resource already exists');
    });

    it('validationError should return 422', async () => {
      const errors = [{ field: 'email', message: 'Required' }];
      const response = validationError(errors);
      
      expect(response.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.details).toEqual(errors);
      expect(body.error.message).toBe('Validation failed');
    });

    it('tooManyRequests should return 429 with Retry-After header', async () => {
      const response = tooManyRequests(60);
      
      expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.headers.get('Retry-After')).toBe('60');
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(body.error.details).toEqual({ retryAfter: 60 });
    });

    it('tooManyRequests should work without retryAfter', async () => {
      const response = tooManyRequests();
      
      expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.headers.get('Retry-After')).toBeNull();
      
      const body = await response.json();
      expect(body.error.details).toBeUndefined();
    });

    it('internalError should return 500', async () => {
      const response = internalError('Database connection failed');
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(body.error.message).toBe('Database connection failed');
    });

    it('internalError should use default message', async () => {
      const response = internalError();
      const body = await response.json();
      expect(body.error.message).toBe('Internal server error');
    });

    it('internalError should log error details', () => {
      const error = new Error('Test error');
      internalError('Failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[INTERNAL_ERROR]',
        expect.objectContaining({
          message: 'Failed',
          error: 'Test error',
          stack: expect.any(String),
        })
      );
    });

    it('internalError should handle non-Error objects', () => {
      internalError('Failed', { custom: 'error' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[INTERNAL_ERROR]',
        expect.objectContaining({
          message: 'Failed',
          error: { custom: 'error' },
        })
      );
    });

    it('serviceUnavailable should return 503', async () => {
      const response = serviceUnavailable('API is down');
      expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR);
      expect(body.error.message).toBe('API is down');
    });

    it('serviceUnavailable should use default message', async () => {
      const response = serviceUnavailable();
      const body = await response.json();
      expect(body.error.message).toBe('Service temporarily unavailable');
    });
  });

  describe('Plain text responses', () => {
    it('plainNotFound should return 404 text/plain', async () => {
      const response = plainNotFound();
      
      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      
      const text = await response.text();
      expect(text).toBe('Not Found');
    });

    it('plainUnauthorized should return 401 text/plain', async () => {
      const response = plainUnauthorized();
      
      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      
      const text = await response.text();
      expect(text).toBe('Unauthorized');
    });

    it('plainForbidden should return 403 text/plain', async () => {
      const response = plainForbidden();
      
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      
      const text = await response.text();
      expect(text).toBe('Forbidden');
    });

    it('plain responses should have no-store cache', () => {
      const responses = [plainNotFound(), plainUnauthorized(), plainForbidden()];
      
      responses.forEach(response => {
        expect(response.headers.get('Cache-Control')).toContain('no-store');
      });
    });
  });

  describe('handlePrismaError', () => {
    it('should handle unique constraint violation (P2002)', async () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
      };

      const response = handlePrismaError(prismaError);
      expect(response.status).toBe(HTTP_STATUS.CONFLICT);
      
      const body = await response.json();
      expect(body.error.message).toContain('email already exists');
    });

    it('should handle P2002 without meta', async () => {
      const prismaError = { code: 'P2002' };

      const response = handlePrismaError(prismaError);
      const body = await response.json();
      expect(body.error.message).toContain('field already exists');
    });

    it('should handle foreign key violation (P2003)', async () => {
      const prismaError = { code: 'P2003' };

      const response = handlePrismaError(prismaError);
      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = await response.json();
      expect(body.error.message).toBe('Invalid reference');
    });

    it('should handle record not found (P2025)', async () => {
      const prismaError = { code: 'P2025' };

      const response = handlePrismaError(prismaError);
      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      
      const body = await response.json();
      expect(body.error.message).toContain('Record not found');
    });

    it('should handle unknown Prisma errors', async () => {
      const prismaError = {
        code: 'P9999',
        message: 'Unknown error',
        meta: { detail: 'some detail' },
      };

      const response = handlePrismaError(prismaError);
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PRISMA_ERROR]',
        expect.objectContaining({
          code: 'P9999',
        })
      );
    });
  });

  describe('handleZodError', () => {
    it('should convert Zod errors to validation response', async () => {
      const zodError = {
        errors: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['password', 'min'], message: 'Too short' },
        ],
      };

      const response = handleZodError(zodError);
      expect(response.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.details).toEqual([
        { field: 'email', message: 'Invalid email' },
        { field: 'password.min', message: 'Too short' },
      ]);
    });

    it('should handle Zod error without errors array', async () => {
      const zodError = {};

      const response = handleZodError(zodError);
      const body = await response.json();
      expect(body.error.details).toEqual([]);
    });
  });

  describe('withErrorHandling', () => {
    it('should pass through successful responses', async () => {
      const handler = vi.fn().mockResolvedValue(
        jsonSuccess({ test: true })
      );

      const wrappedHandler = withErrorHandling(handler);
      const req = new Request('http://localhost');
      
      const response = await wrappedHandler(req);
      expect(response.status).toBe(HTTP_STATUS.OK);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(req, undefined);
    });

    it('should handle Prisma errors', async () => {
      const handler = vi.fn().mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(new Request('http://localhost'));
      
      expect(response.status).toBe(HTTP_STATUS.CONFLICT);
    });

    it('should handle Zod errors', async () => {
      const handler = vi.fn().mockRejectedValue({
        errors: [{ path: ['email'], message: 'Required' }],
      });

      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(new Request('http://localhost'));
      
      expect(response.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    });

    it('should handle Error objects', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Something failed'));

      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(new Request('http://localhost'));
      
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = await response.json();
      expect(body.error.message).toBe('Something failed');
    });

    it('should handle unknown errors', async () => {
      const handler = vi.fn().mockRejectedValue('string error');

      const wrappedHandler = withErrorHandling(handler);
      const response = await wrappedHandler(new Request('http://localhost'));
      
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      const body = await response.json();
      expect(body.error.message).toBe('Unknown error');
    });

    it('should pass context to handler', async () => {
      const handler = vi.fn().mockResolvedValue(jsonSuccess({ test: true }));

      const wrappedHandler = withErrorHandling(handler);
      const req = new Request('http://localhost');
      const context = { params: { id: '123' } };
      
      await wrappedHandler(req, context);
      expect(handler).toHaveBeenCalledWith(req, context);
    });
  });

  describe('Type guards', () => {
    it('isApiSuccess should identify success responses', async () => {
      const successResponse = jsonSuccess({ test: true });
      const body = await successResponse.json();
      
      expect(isApiSuccess(body)).toBe(true);
      expect(isApiError(body)).toBe(false);
    });

    it('isApiError should identify error responses', async () => {
      const errorResponse = badRequest('Invalid');
      const body = await errorResponse.json();
      
      expect(isApiError(body)).toBe(true);
      expect(isApiSuccess(body)).toBe(false);
    });

    it('should work with type narrowing', async () => {
      const response = jsonSuccess({ value: 42 });
      const body = await response.json();

      if (isApiSuccess(body)) {
        // TypeScript should know body.data exists
        expect(body.data.value).toBe(42);
      }
    });
  });

  describe('HTTP_STATUS constants', () => {
    it('should have correct status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.NO_CONTENT).toBe(204);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
      expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('Cache-Control headers', () => {
    it('should always include no-store for JSON responses', () => {
      const responses = [
        jsonSuccess({ test: true }),
        badRequest('error'),
        unauthorized(),
        notFound(),
      ];

      responses.forEach(response => {
        const cacheControl = response.headers.get('Cache-Control');
        expect(cacheControl).toContain('no-store');
        expect(cacheControl).toContain('no-cache');
        expect(cacheControl).toContain('must-revalidate');
      });
    });
  });
});
