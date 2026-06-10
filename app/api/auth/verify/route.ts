// app/api/auth/verify/route.ts
import { NextResponse } from "next/server";
import { verifyEmailVerifyToken } from '@/lib/server/tokens';
import { prisma } from '@/lib/server/prisma';
import crypto from "crypto";

/** Solo aceptamos rutas relativas para evitar open redirects */
function sanitizeCallbackUrl(cb?: string | null): string | undefined {
  if (!cb) return undefined;
  try {
    if (cb.startsWith("/")) return cb;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const token = urlObj.searchParams.get("token") || "";
  const callbackUrl = sanitizeCallbackUrl(urlObj.searchParams.get("callbackUrl"));

  try {
    const { email } = await verifyEmailVerifyToken(token);

    // ✅ Atomic transaction: verify email + generate auto-login token together
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user) throw new Error("Usuario no encontrado");

      // Marca emailVerified si aún no lo estaba
      if (!user.emailVerified) {
        await tx.user.update({
          where: { email },
          data: { emailVerified: new Date() },
        });

        // Auto-aprobar perfil de reclutador al verificar email
        if (user.role === "RECRUITER") {
          await tx.recruiterProfile.updateMany({
            where: { userId: user.id, status: "PENDING" },
            data: { status: "APPROVED" },
          });
        }
      }

      // ✅ Generar token de auto-login de un solo uso (válido 5 minutos)
      const autoLoginToken = crypto.randomBytes(32).toString("hex");
      await tx.autoLoginToken.create({
        data: {
          token: autoLoginToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return { user, autoLoginToken };
    });

    const dest = new URL("/auth/verify", req.url);
    dest.searchParams.set("status", "ok");
    dest.searchParams.set("role", result.user.role || "CANDIDATE");
    dest.searchParams.set("alt", result.autoLoginToken); // ✅ para auto-login en el cliente
    if (callbackUrl) dest.searchParams.set("callbackUrl", callbackUrl);

    return NextResponse.redirect(dest);
  } catch {
    const fail = new URL("/auth/verify", req.url);
    fail.searchParams.set("status", "failed");
    return NextResponse.redirect(fail);
  }
}