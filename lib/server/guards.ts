// lib/server/guards.ts
import 'server-only'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/server/auth'

/**
 * Guard para endpoints de desarrollo
 * Retorna true si está permitido, false si debe bloquearse
 */
export function isDevelopmentAllowed(): boolean {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  // Feature flag adicional (opcional pero recomendado)
  if (process.env.DEBUG_ROUTES_ENABLED !== 'true') {
    return false
  }

  return true
}

/**
 * Guard para endpoints de admin
 */
export async function isAdminUser(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN'
}

/**
 * Response de "Not Found" para ocultar la existencia del endpoint
 */
export function notFoundResponse() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

/**
 * Response de "Forbidden"
 */
export function forbiddenResponse(reason?: string) {
  return new Response(
    JSON.stringify({
      error: 'Forbidden',
      reason: reason || 'Insufficient permissions',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Guard combinado: desarrollo + admin
 * @returns Response si está bloqueado, null si está permitido
 */
export async function requireDebugAccess(): Promise<Response | null> {
  // 1. Verificar que sea desarrollo
  if (!isDevelopmentAllowed()) {
    return notFoundResponse()
  }

  // 2. Verificar que sea admin (opcional, pero recomendado)
  const isAdmin = await isAdminUser()
  if (!isAdmin) {
    return forbiddenResponse('Admin role required')
  }

  // null = permitido
  return null
}