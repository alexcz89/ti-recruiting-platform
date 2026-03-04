// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createEmailVerifyToken } from "@/lib/server/tokens";
import { sendVerificationEmail } from "@/lib/server/mailer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerified: true, firstName: true, name: true },
    });

    // Por seguridad no revelamos si existe o no
    if (!user) return NextResponse.json({ ok: true });

    if (user.emailVerified) {
      return NextResponse.json({ error: "El email ya está verificado" }, { status: 400 });
    }

    const token = await createEmailVerifyToken({ email: user.email }, 60);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    // ✅ Firma correcta: (to: string, verifyUrl: string)
    await sendVerificationEmail(user.email, verifyUrl);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json({ error: "Error al reenviar email" }, { status: 500 });
  }
}