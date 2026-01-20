// __tests__/server/api-response.test.ts
import { describe, it, expect } from 'vitest';
import {
  jsonSuccess,
  jsonError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  internalError,
  plainNotFound,
  plainUnauthorized,
  plainForbidden,
  HTTP_STATUS,
  ERROR_CODES,
  isApiSuccess,
  isApiError,
} from '@/lib/server/api-response';

describe('API Response Helpers', () => {
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
  });

  describe('Error helpers', () => {
    it('badRequest should return 400', async () => {
      const response = badRequest('Invalid input');
      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('unauthorized should return 401', async () => {
      const response = unauthorized();
      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('forbidden should return 403', async () => {
      const response = forbidden('Not allowed');
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('notFound should return 404', async () => {
      const response = notFound('User');
      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      
      const body = await response.json();
      expect(body.error.message).toContain('User not found');
    });

    it('conflict should return 409', async () => {
      const response = conflict('Email already exists');
      expect(response.status).toBe(HTTP_STATUS.CONFLICT);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.CONFLICT);
    });

    it('validationError should return 422', async () => {
      const errors = [{ field: 'email', message: 'Required' }];
      const response = validationError(errors);
      
      expect(response.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(body.error.details).toEqual(errors);
    });

    it('tooManyRequests should return 429 with Retry-After header', async () => {
      const response = tooManyRequests(60);
      
      expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.headers.get('Retry-After')).toBe('60');
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });

    it('internalError should return 500', async () => {
      const response = internalError('Database connection failed');
      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = await response.json();
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
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
      const response = plainNotFound();
      expect(response.headers.get('Cache-Control')).toContain('no-store');
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
  });

  describe('HTTP_STATUS constants', () => {
    it('should have correct status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
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
