import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type AuthToken = {
  role?: string;
  companyId?: string | null;
};

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = (req as any).nextauth?.token as AuthToken | undefined;

    const role = String(token?.role ?? "").toUpperCase();
    const isRecruiterOrAdmin = role === "RECRUITER" || role === "ADMIN";

    // ===== 🔐 DEBUG ENDPOINTS =====
    if (pathname.startsWith("/api/debug-")) {
      if (process.env.NODE_ENV === "production") {
        console.warn(`🚨 [SECURITY] Blocked debug endpoint in production: ${pathname}`);
        return new Response("Not Found", { status: 404 });
      }

      if (process.env.DEBUG_ROUTES_ENABLED !== "true") {
        console.warn(`🚨 [SECURITY] Debug routes disabled: ${pathname}`);
        return new Response("Not Found", { status: 404 });
      }

      console.log(`🔧 [DEBUG] Allowed access to: ${pathname}`);
      return NextResponse.next();
    }

    // ===== /assessments =====
    if (pathname.startsWith("/assessments")) {
      if (isRecruiterOrAdmin) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    }

    // ===== /jobs =====
    if (pathname.startsWith("/jobs")) {
      const isJobDetail = /^\/jobs\/[^/]+$/.test(pathname);

      if (isJobDetail) {
        return NextResponse.next();
      }

      if (isRecruiterOrAdmin) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard/jobs";
        url.search = "";
        url.searchParams.set("from", pathname + (search || ""));
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    }

    // ===== /dashboard =====
    // La autorización real se decide en callbacks.authorized.
    // Aquí no forzamos lógica extra para evitar duplicar reglas.
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.next();
    }

    // ===== /profile =====
    if (pathname.startsWith("/profile")) {
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/signin",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        const role = String((token as AuthToken | undefined)?.role ?? "").toUpperCase();
        const isRecruiterOrAdmin = role === "RECRUITER" || role === "ADMIN";

        if (pathname.startsWith("/assessments")) {
          return !!token;
        }

        // Importante:
        // esta excepción debe ir antes del guard general de /dashboard,
        // porque /dashboard/notifications también hace match con /dashboard.
        // Cualquier usuario autenticado puede entrar a sus notificaciones.
        if (pathname.startsWith("/dashboard/notifications")) {
          return !!token;
        }

        // Dashboard general: solo recruiter/admin
        if (pathname.startsWith("/dashboard")) {
          return !!token && isRecruiterOrAdmin;
        }

        if (pathname.startsWith("/profile")) {
          return !!token;
        }

        if (pathname.startsWith("/jobs")) {
          return true;
        }

        if (pathname.startsWith("/api/debug-")) {
          return true;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/assessments/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/jobs/:path*",
    "/api/debug-:path*",
  ],
};