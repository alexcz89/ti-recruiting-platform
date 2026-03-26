// middleware.ts
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
    // FIX Bug #9:
    // - Si no hay sesión, NO redirigimos manualmente aquí.
    //   Dejamos que withAuth + pages.signIn resuelva a /signin
    //   preservando callbackUrl automáticamente.
    // - Si sí hay sesión pero es recruiter/admin, no debe entrar al flujo candidato.
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

        // /assessments requiere sesión.
        // withAuth redirige a /signin?callbackUrl=... automáticamente.
        if (pathname.startsWith("/assessments")) {
          return !!token;
        }

        // Todo dashboard requiere sesión recruiter/admin
        if (pathname.startsWith("/dashboard")) {
          return !!token && isRecruiterOrAdmin;
        }

        // Profile requiere cualquier sesión
        if (pathname.startsWith("/profile")) {
          return !!token;
        }

        // Jobs públicos
        if (pathname.startsWith("/jobs")) {
          return true;
        }

        // Debug endpoints: mismos controles duros en middleware;
        // aquí solo permitimos continuar para que el middleware los evalúe.
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