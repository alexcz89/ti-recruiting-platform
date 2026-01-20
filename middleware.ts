// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = (req as any).nextauth?.token as
      | { role?: string; companyId?: string | null }
      | undefined;

    const role = token?.role;
    const isRecruiterOrAdmin = role === "RECRUITER" || role === "ADMIN";

    // ===== 🔐 DEBUG ENDPOINTS (NUEVO) =====
    // Bloquear endpoints de debug en producción
    if (pathname.startsWith("/api/debug-")) {
      if (process.env.NODE_ENV === "production") {
        console.warn(`🚨 [SECURITY] Blocked debug endpoint in production: ${pathname}`);
        return new Response("Not Found", { status: 404 });
      }

      if (process.env.DEBUG_ROUTES_ENABLED !== "true") {
        console.warn(`🚨 [SECURITY] Debug routes disabled: ${pathname}`);
        return new Response("Not Found", { status: 404 });
      }

      // Log de acceso en desarrollo
      console.log(`🔧 [DEBUG] Allowed access to: ${pathname}`);
    }

    // ===== /jobs =====
    if (pathname.startsWith("/jobs")) {
      // ✅ Permitir ver /jobs/[id] siempre
      const isJobDetail = /^\/jobs\/[^/]+$/.test(pathname);
      if (isJobDetail) return NextResponse.next();

      // ❌ Si es listado /jobs y el usuario es recruiter/admin → mandar a dashboard/jobs
      if (isRecruiterOrAdmin) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard/jobs";
        url.searchParams.set("from", pathname + (search || ""));
        return NextResponse.redirect(url);
      }

      // Público (candidatos / no logueados) pueden ver /jobs
      return NextResponse.next();
    }

    // ===== /dashboard =====
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/signin" },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Dashboard: requiere auth + rol recruiter/admin
        if (pathname.startsWith("/dashboard")) {
          if (!token) return false;
          const role = (token as any)?.role;
          return role === "RECRUITER" || role === "ADMIN";
        }

        // Perfil: requiere estar logueado
        if (pathname.startsWith("/profile")) {
          return !!token;
        }

        // /jobs es público; las redirecciones se manejan arriba
        if (pathname.startsWith("/jobs")) {
          return true;
        }

        // Resto de rutas del matcher
        return true;
      },
    },
  }
);

// Limita el middleware a estas rutas
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/jobs/:path*",
    "/api/debug-:path*", // ✨ NUEVO: Proteger debug endpoints
  ],
};