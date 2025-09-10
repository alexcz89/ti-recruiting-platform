// middleware.ts
import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    // Aquí puedes poner lógica adicional si quieres
    // Por ejemplo, logs de auditoría o ajustes a la URL
  },
  {
    pages: { signIn: "/signin" }, // usa tu página personalizada
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Si no hay token (no logueado), solo permitimos rutas públicas
        if (!token) {
          // Estas rutas están en matcher, así que si no hay token → false (redirige a /signin)
          return false;
        }

        // Con token → validamos rol en /dashboard
        if (pathname.startsWith("/dashboard")) {
          const role = (token as any).role;
          return role === "RECRUITER" || role === "ADMIN";
        }

        // /profile: basta con estar logueado
        if (pathname.startsWith("/profile")) {
          return true;
        }

        // Cualquier otra ruta no listada en matcher → ignorada por el middleware
        return true;
      },
    },
  }
);

// Limita el middleware a estas rutas:
export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
