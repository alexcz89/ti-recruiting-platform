// app/api/debug-session/route.ts
/**
 * Endpoint de debug protegido con múltiples capas de seguridad
 * 
 * PROTECCIONES:
 * 1. ✅ NODE_ENV === 'development' (estricto, no permite test/staging/preview)
 * 2. ✅ DEBUG_ROUTES_ENABLED === 'true'
 * 3. ✅ x-debug-key header (si DEBUG_ROUTES_KEY está configurado)
 * 4. ✅ Usuario con rol ADMIN
 * 5. ✅ Retorna 404 plain text (no JSON) si está bloqueado
 * 
 * CONFIGURACIÓN (.env):
 * ```
 * # Development only
 * NODE_ENV=development
 * DEBUG_ROUTES_ENABLED=true
 * DEBUG_ROUTES_KEY=mi-clave-secreta-muy-larga  # Opcional pero recomendado
 * ```
 * 
 * USO:
 * ```bash
 * # Sin debug key configurada
 * curl http://localhost:3000/api/debug-session
 * 
 * # Con debug key configurada
 * curl http://localhost:3000/api/debug-session \
 *   -H "x-debug-key: mi-clave-secreta-muy-larga"
 * ```
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/server/auth';
import { requireDebugAccess } from '@/lib/server/guards';
import { jsonSuccess } from '@/lib/server/api-response';

export async function GET(req: Request) {
  // 🛡️ GUARD: Verificar todos los requisitos de seguridad
  const guardResponse = await requireDebugAccess(req);
  if (guardResponse) {
    return guardResponse; // 404 plain text si está bloqueado
  }

  // ✅ PERMITIDO: Mostrar debug info
  const session = await getServerSession(authOptions);

  return jsonSuccess({
    session: {
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      } : null,
      expires: session?.expires,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      debugEnabled: process.env.DEBUG_ROUTES_ENABLED === 'true',
      hasDebugKey: !!process.env.DEBUG_ROUTES_KEY,
    },
    timestamp: new Date().toISOString(),
  });
}