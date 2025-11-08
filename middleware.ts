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
    // Antes redirigíamos a /onboarding/company si no había companyId.
    // Lo quitamos para evitar el 404, dejando que el dashboard cargue.
    // (Si después creas la página de onboarding, puedes reactivar la redirección.)
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

// Limita el middleware a estas rutas (no afecta /api)
export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/jobs/:path*"],
};
