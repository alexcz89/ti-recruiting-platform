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

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Usuario no encontrado");

    // Marca emailVerified si aún no lo estaba
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { email },
        data: { emailVerified: new Date() },
      });
    }

    // ✅ Generar token de auto-login de un solo uso (válido 5 minutos)
    const autoLoginToken = crypto.randomBytes(32).toString("hex");
    await prisma.autoLoginToken.create({
      data: {
        token: autoLoginToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const dest = new URL("/auth/verify", req.url);
    dest.searchParams.set("status", "ok");
    dest.searchParams.set("role", user.role || "CANDIDATE");
    dest.searchParams.set("alt", autoLoginToken); // ✅ para auto-login en el cliente
    if (callbackUrl) dest.searchParams.set("callbackUrl", callbackUrl);

    return NextResponse.redirect(dest);
  } catch {
    const fail = new URL("/auth/verify", req.url);
    fail.searchParams.set("status", "failed");
    return NextResponse.redirect(fail);
  }
}