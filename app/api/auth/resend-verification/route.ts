// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createEmailVerifyToken } from "@/lib/server/tokens";
import { sendVerificationEmail } from "@/lib/server/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Normalizar email
    const normalizedEmail = email.toLowerCase().trim();

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        name: true,
      },
    });

    if (!user) {
      // Por seguridad, no revelamos si el usuario existe
      // Pero devolvemos ok para no dar pistas a atacantes
      return NextResponse.json({ ok: true });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "El email ya está verificado" },
        { status: 400 }
      );
    }

    // ✅ Crear token JWT (expira en 60 minutos)
    const token = await createEmailVerifyToken(
      { email: user.email },
      60 // minutos
    );

    // ✅ Enviar email con el token
    await sendVerificationEmail({
      email: user.email,
      name: user.firstName || user.name || "Usuario",
      token,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json(
      { error: "Error al reenviar email" },
      { status: 500 }
    );
  }
}