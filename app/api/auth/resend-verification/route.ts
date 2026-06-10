// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createEmailVerifyToken } from "@/lib/server/tokens";
import { sendVerificationEmail } from "@/lib/server/mailer";
import {
  checkEmailRateLimit,
  getClientIp,
  formatRetryAfter,
  RATE_LIMITS,
} from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const clientIp = getClientIp(request.headers);

    // ✅ Verificar rate limit para prevenir abuse
    const rateLimit = checkEmailRateLimit(
      normalizedEmail,
      RATE_LIMITS.EMAIL_VERIFICATION_RESEND
    );

    if (!rateLimit.allowed) {
      const retryAfter = rateLimit.retryAfter || 3600;
      return NextResponse.json(
        {
          error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(retryAfter)}.`,
          retryAfter,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerified: true, firstName: true, name: true },
    });

    // ✅ Por seguridad no revelamos si existe o no (devolvemos ok: true)
    if (!user) {
      // Pero aún así consumimos el rate limit para prevenir enumeration
      return NextResponse.json({ ok: true });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "El email ya está verificado" },
        { status: 400 }
      );
    }

    const token = await createEmailVerifyToken({ email: user.email }, 60);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    // ✅ Enviar email con retry logic incorporado
    await sendVerificationEmail(user.email, verifyUrl);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json(
      { error: "Error al reenviar email" },
      { status: 500 }
    );
  }
}