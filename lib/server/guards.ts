// lib/server/guards.ts
import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { plainNotFound } from '@/lib/server/api-response';

/**
 * Guards de seguridad para proteger endpoints sensibles
 * 
 * IMPORTANTE: Estos guards están diseñados con "fail closed" (denegar por defecto)
 * y usan plainNotFound() para no revelar la existencia de endpoints protegidos.
 */

/**
 * Verifica si el entorno permite debug routes
 * 
 * ESTRICTO: Solo permite `development`, NO `test`, `staging`, ni `preview`
 * para evitar exposición accidental en ambientes no locales.
 */
export function isDevelopmentAllowed(): boolean {
  // Solo permitir en desarrollo ESTRICTO
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  // Feature flag adicional (recomendado)
  if (process.env.DEBUG_ROUTES_ENABLED !== 'true') {
    return false;
  }

  return true;
}

/**
 * Verifica si el usuario actual es ADMIN
 */
export async function isAdminUser(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

/**
 * Verifica si el request incluye la debug key correcta (opcional pero recomendado)
 * 
 * Agrega una capa extra de seguridad requiriendo un header secreto.
 * 
 * @example En .env:
 * DEBUG_ROUTES_KEY=mi-clave-secreta-muy-larga
 * 
 * @example En request:
 * headers: { 'x-debug-key': 'mi-clave-secreta-muy-larga' }
 */
export function hasDebugKey(req?: Request): boolean {
  const requiredKey = process.env.DEBUG_ROUTES_KEY;
  
  // Si no hay key configurada, permitir (para dev local simple)
  if (!requiredKey) {
    return true;
  }
  
  // Si hay key configurada, verificar que coincida
  const providedKey = req?.headers.get('x-debug-key') || '';
  return providedKey === requiredKey;
}

/**
 * Guard combinado para endpoints de debug/admin
 * 
 * Verifica (en orden):
 * 1. NODE_ENV === 'development' (estricto)
 * 2. DEBUG_ROUTES_ENABLED === 'true'
 * 3. x-debug-key header (si DEBUG_ROUTES_KEY está configurado)
 * 4. Usuario con rol ADMIN
 * 
 * @returns Response si está bloqueado, null si está permitido
 * 
 * @example
 * export async function GET(req: Request) {
 *   const guard = await requireDebugAccess(req);
 *   if (guard) return guard;
 *   
 *   // Endpoint protegido...
 *   return jsonSuccess({ debug: 'data' });
 * }
 */
export async function requireDebugAccess(req?: Request): Promise<Response | null> {
  // 1. Verificar entorno y feature flag
  if (!isDevelopmentAllowed()) {
    return plainNotFound();
  }

  // 2. Verificar debug key (si está configurada)
  if (!hasDebugKey(req)) {
    return plainNotFound();
  }

  // 3. Verificar que sea admin
  const isAdmin = await isAdminUser();
  if (!isAdmin) {
    return plainNotFound();
  }

  // null = permitido
  return null;
}

/**
 * Guard simple: solo verifica autenticación
 * 
 * @example
 * export async function GET() {
 *   const guard = await requireAuth();
 *   if (guard) return guard;
 *   
 *   // Usuario autenticado...
 * }
 */
export async function requireAuth(): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return plainNotFound(); // No revelar que existe el endpoint
  }
  
  return null;
}

/**
 * Guard: requiere rol específico
 * 
 * @example
 * export async function POST(req: Request) {
 *   const guard = await requireRole('RECRUITER');
 *   if (guard) return guard;
 *   
 *   // Usuario con rol RECRUITER...
 * }
 */
export async function requireRole(role: 'ADMIN' | 'RECRUITER' | 'CANDIDATE'): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return plainNotFound();
  }
  
  if (session.user?.role !== role) {
    return plainNotFound(); // No revelar el rol requerido
  }
  
  return null;
}

/**
 * Guard: requiere uno de varios roles
 * 
 * @example
 * export async function GET() {
 *   const guard = await requireAnyRole(['ADMIN', 'RECRUITER']);
 *   if (guard) return guard;
 *   
 *   // Usuario con rol ADMIN o RECRUITER...
 * }
 */
export async function requireAnyRole(roles: Array<'ADMIN' | 'RECRUITER' | 'CANDIDATE'>): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return plainNotFound();
  }
  
  if (!session.user?.role || !roles.includes(session.user.role as any)) {
    return plainNotFound();
  }
  
  return null;
}

/**
 * Guard: verifica que el usuario sea dueño del recurso
 * 
 * @example
 * export async function GET(req: Request, { params }: { params: { id: string } }) {
 *   const guard = await requireOwnership(params.id);
 *   if (guard) return guard;
 *   
 *   // Usuario es dueño del recurso...
 * }
 */
export async function requireOwnership(userId: string): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return plainNotFound();
  }
  
  // Admins pueden acceder a cualquier recurso
  if (session.user?.role === 'ADMIN') {
    return null;
  }
  
  // Verificar que el userId coincida
  if (session.user?.id !== userId) {
    return plainNotFound();
  }
  
  return null;
}