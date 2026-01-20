// app/api/debug-session/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/server/auth'
import { requireDebugAccess } from '@/lib/server/guards'

export async function GET() {
  // ✅ GUARD: Verificar acceso
  // Solo permite acceso si:
  // 1. NODE_ENV=development
  // 2. DEBUG_ROUTES_ENABLED=true
  // 3. Usuario es ADMIN
  const guardResponse = await requireDebugAccess()
  if (guardResponse) {
    return guardResponse // Bloqueado
  }

  // ✅ PERMITIDO: Mostrar debug info
  const session = await getServerSession(authOptions)

  return new Response(
    JSON.stringify({
      session,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      debugEnabled: process.env.DEBUG_ROUTES_ENABLED,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  )
}