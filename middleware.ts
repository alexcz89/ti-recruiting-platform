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
      // ✅ Permitir la vista pública del detalle /jobs/[id] para recruiter/admin
      //    (app/jobs/[id]/page.tsx ya valida que solo vean vacantes de su empresa)
      const isJobDetail = /^\/jobs\/[^/]+$/.test(pathname);
      if (isJobDetail) {
        return NextResponse.next();
      }

      // ❌ Si es el listado /jobs o cualquier subruta que no sea detalle,
      //    los recruiter/admin van al dashboard
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
      // Onboarding si no tiene companyId (solo recruiter/admin)
      if (isRecruiterOrAdmin && !token?.companyId) {
        const url = req.nextUrl.clone();
        url.pathname = "/onboarding/company";
        url.searchParams.set("from", pathname + (search || ""));
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/signin" },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Dashboard: requiere auth + rol
        if (pathname.startsWith("/dashboard")) {
          if (!token) return false;
          const role = (token as any)?.role;
          return role === "RECRUITER" || role === "ADMIN";
        }

        // Perfil: requiere estar logueado
        if (pathname.startsWith("/profile")) {
          return !!token;
        }

        // /jobs es público; las redirecciones (si aplica) se manejan arriba
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
