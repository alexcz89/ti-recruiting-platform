// middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    const token = (req as any).nextauth?.token as
      | { role?: string; companyId?: string | null }
      | undefined

    // Si intenta acceder al dashboard y NO tiene companyId, lo llevamos a onboarding
    if (pathname.startsWith("/dashboard")) {
      if (token && (token.role === "RECRUITER" || token.role === "ADMIN")) {
        if (!token.companyId) {
          const url = req.nextUrl.clone()
          url.pathname = "/onboarding/company" // crea esta ruta si no existe
          url.searchParams.set("from", pathname)
          return NextResponse.redirect(url)
        }
      }
    }

    // Puedes añadir aquí logs/auditoría si gustas
    return NextResponse.next()
  },
  {
    // usa tu página personalizada de login; si prefieres la de NextAuth, pon "/api/auth/signin"
    pages: { signIn: "/signin" },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // No logueado → no pasa a las rutas protegidas
        if (!token) return false

        // /dashboard: requiere RECRUITER o ADMIN
        if (pathname.startsWith("/dashboard")) {
          const role = (token as any).role
          return role === "RECRUITER" || role === "ADMIN"
        }

        // /profile: con estar logueado basta
        if (pathname.startsWith("/profile")) {
          return true
        }

        // Cualquier otra ruta listada en matcher, si llegara a existir
        return true
      },
    },
  }
)

// Limita el middleware a estas rutas protegidas (no afecta /api)
export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
}
