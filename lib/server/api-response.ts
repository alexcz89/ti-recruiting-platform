// lib/server/api-response.ts
import 'server-only';

/**
 * Sistema de API Responses estandarizadas para Next.js 14 App Router
 * 
 * BENEFICIOS:
 * - ✅ Responses consistentes en todos los endpoints
 * - ✅ Type safety completo
 * - ✅ Cache control automático
 * - ✅ Logging centralizado
 * - ✅ Manejo de errores estandarizado
 * 
 * NOTA: Usamos `new Response()` en lugar de `NextResponse.json()` para:
 * - Mayor control sobre headers
 * - Compatibilidad con middlewares
 * - Funciona perfecto en Next.js 14 App Router
 */

// ============================================
// Types
// ============================================

export type ApiSuccessResponse<T = any> = {
  success: true;
  data: T;
  timestamp?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  timestamp?: string;
};

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Error Codes Estándar
// ============================================

export const ERROR_CODES = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================
// HTTP Status Helpers
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================
// Response Builders
// ============================================

/**
 * Crea un Response JSON exitoso sin cache
 * 
 * @example
 * return jsonSuccess({ user: { id: '123', name: 'John' } });
 * 
 * @example con status personalizado
 * return jsonSuccess({ id: '123' }, { status: 201 });
 */
export function jsonSuccess<T>(
  data: T,
  options?: {
    status?: number;
    headers?: HeadersInit;
    includeTimestamp?: boolean;
  }
): Response {
  const { status = HTTP_STATUS.OK, headers, includeTimestamp = false } = options || {};

  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(includeTimestamp && { timestamp: new Date().toISOString() }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...headers,
    },
  });
}

/**
 * Crea un Response JSON de error sin cache
 * 
 * @example
 * return jsonError('User not found', { status: 404 });
 * 
 * @example con código de error
 * return jsonError('Email already exists', {
 *   status: 409,
 *   code: ERROR_CODES.CONFLICT,
 * });
 */
export function jsonError(
  message: string,
  options?: {
    status?: number;
    code?: ErrorCode | string;
    details?: any;
    headers?: HeadersInit;
    includeTimestamp?: boolean;
  }
): Response {
  const {
    status = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code,
    details,
    headers,
    includeTimestamp = false,
  } = options || {};

  const body: ApiErrorResponse = {
    success: false,
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
    ...(includeTimestamp && { timestamp: new Date().toISOString() }),
  };

  // Log errors de servidor (5xx)
  if (status >= 500) {
    console.error('[API_ERROR]', {
      message,
      code,
      details,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...headers,
    },
  });
}

/**
 * Alias: jsonSuccess con nombre más explícito
 */
export const jsonOk = jsonSuccess;

/**
 * Response JSON sin cache (para datos que cambian frecuentemente)
 * Similar a jsonSuccess pero más explícito sobre el cache
 * 
 * @example
 * return jsonNoStore({ jobs: [...] });
 */
export function jsonNoStore<T>(data: T, status = HTTP_STATUS.OK): Response {
  return jsonSuccess(data, { status });
}

// ============================================
// Helpers de errores comunes
// ============================================

/**
 * 400 Bad Request
 */
export function badRequest(message = 'Bad request', details?: any): Response {
  return jsonError(message, {
    status: HTTP_STATUS.BAD_REQUEST,
    code: ERROR_CODES.BAD_REQUEST,
    details,
  });
}

/**
 * 401 Unauthorized (no autenticado)
 */
export function unauthorized(message = 'Authentication required'): Response {
  return jsonError(message, {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: ERROR_CODES.UNAUTHORIZED,
  });
}

/**
 * 403 Forbidden (autenticado pero sin permisos)
 */
export function forbidden(message = 'Insufficient permissions'): Response {
  return jsonError(message, {
    status: HTTP_STATUS.FORBIDDEN,
    code: ERROR_CODES.FORBIDDEN,
  });
}

/**
 * 404 Not Found
 */
export function notFound(resource = 'Resource'): Response {
  return jsonError(`${resource} not found`, {
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODES.NOT_FOUND,
  });
}

/**
 * 409 Conflict (recurso ya existe)
 */
export function conflict(message = 'Resource already exists'): Response {
  return jsonError(message, {
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODES.CONFLICT,
  });
}

/**
 * 422 Validation Error
 */
export function validationError(errors: any): Response {
  return jsonError('Validation failed', {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODES.VALIDATION_ERROR,
    details: errors,
  });
}

/**
 * 429 Too Many Requests
 */
export function tooManyRequests(retryAfter?: number): Response {
  const headers: HeadersInit = retryAfter
    ? { 'Retry-After': retryAfter.toString() }
    : {};

  return jsonError('Too many requests', {
    status: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    headers,
    details: retryAfter ? { retryAfter } : undefined,
  });
}

/**
 * 500 Internal Server Error
 */
export function internalError(message = 'Internal server error', error?: any): Response {
  // Log detallado del error
  if (error) {
    console.error('[INTERNAL_ERROR]', {
      message,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // No revelar detalles internos al cliente
  return jsonError(message, {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
  });
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(message = 'Service temporarily unavailable'): Response {
  return jsonError(message, {
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
  });
}

// ============================================
// Plain Text Responses (para seguridad)
// ============================================

/**
 * 404 Not Found en texto plano (oculta la existencia del endpoint)
 * 
 * Útil para endpoints de debug/admin que no quieres revelar.
 * No retorna JSON, solo "Not Found" como texto plano.
 * 
 * @example
 * if (!isDevelopmentAllowed()) return plainNotFound();
 */
export function plainNotFound(): Response {
  return new Response('Not Found', {
    status: HTTP_STATUS.NOT_FOUND,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * 401 Unauthorized en texto plano
 * 
 * Similar a plainNotFound pero para casos donde quieres indicar
 * que se requiere autenticación sin revelar detalles del endpoint.
 * 
 * @example
 * if (!session) return plainUnauthorized();
 */
export function plainUnauthorized(): Response {
  return new Response('Unauthorized', {
    status: HTTP_STATUS.UNAUTHORIZED,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

/**
 * 403 Forbidden en texto plano
 * 
 * @example
 * if (!isAdmin) return plainForbidden();
 */
export function plainForbidden(): Response {
  return new Response('Forbidden', {
    status: HTTP_STATUS.FORBIDDEN,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

// ============================================
// Utility: Manejo de errores de Prisma
// ============================================

/**
 * Convierte errores de Prisma en responses amigables
 */
export function handlePrismaError(error: any): Response {
  // Error de unique constraint (P2002)
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field';
    return conflict(`${field} already exists`);
  }

  // Error de foreign key (P2003)
  if (error.code === 'P2003') {
    return badRequest('Invalid reference');
  }

  // Error de not found (P2025)
  if (error.code === 'P2025') {
    return notFound('Record');
  }

  // Error genérico de base de datos
  console.error('[PRISMA_ERROR]', {
    code: error.code,
    message: error.message,
    meta: error.meta,
  });

  return internalError('Database error', error);
}

// ============================================
// Utility: Manejo de errores de Zod
// ============================================

/**
 * Convierte errores de Zod en responses de validación
 */
export function handleZodError(error: any): Response {
  const errors = error.errors?.map((err: any) => ({
    field: err.path.join('.'),
    message: err.message,
  })) || [];

  return validationError(errors);
}

// ============================================
// Utility: Try-catch wrapper
// ============================================

/**
 * Wrapper para manejar errores automáticamente en API routes
 * 
 * @example
 * export const GET = withErrorHandling(async (req) => {
 *   const data = await fetchData();
 *   return jsonSuccess(data);
 * });
 */
export function withErrorHandling(
  handler: (req: Request, context?: any) => Promise<Response>
) {
  return async (req: Request, context?: any): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (error) {
      // Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        return handlePrismaError(error);
      }

      // Zod errors
      if (error && typeof error === 'object' && 'errors' in error) {
        return handleZodError(error);
      }

      // Generic errors
      return internalError(
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
    }
  };
}

// ============================================
// Type Guards
// ============================================

/**
 * Type guard para verificar si una response es exitosa
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard para verificar si una response es un error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}