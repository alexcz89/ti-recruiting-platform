// app/dashboard/components/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEmailVerifyToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mailer";
import { redirect } from "next/navigation";

// Rate limit súper simple en memoria por email: 60s
const rl: Map<string, number> = (globalThis as any).__resend_rl__ || new Map();
(globalThis as any).__resend_rl__ = rl;

export async function resendVerificationAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") || "/dashboard/overview");
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    // Sin sesión o sin email — regresar silenciosamente
    redirect(`${returnTo}?resent=0`);
  }

  const now = Date.now();
  const last = rl.get(email) || 0;
  if (now - last < 60_000) {
    // Cooldown de 60s
    redirect(`${returnTo}?resent=rate`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  // Si no existe o ya está verificado, no tiene caso re-enviar
  if (!user || user.emailVerified) {
    redirect(`${returnTo}?resent=done`);
  }

  const token = await createEmailVerifyToken({ email }, 60);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await sendVerificationEmail(email, verifyUrl);

  rl.set(email, now);
  redirect(`${returnTo}?resent=1`);
}

// Client-friendly version that returns a result instead of redirecting
export async function resendVerificationActionClient() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    return { ok: false, message: "No hay sesión activa" };
  }

  const now = Date.now();
  const last = rl.get(email) || 0;
  if (now - last < 60_000) {
    return { ok: false, message: "Espera 60 segundos antes de reenviar" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  if (!user) {
    return { ok: false, message: "Usuario no encontrado" };
  }

  if (user.emailVerified) {
    return { ok: true, message: "Tu email ya está verificado" };
  }

  try {
    const token = await createEmailVerifyToken({ email }, 60);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    await sendVerificationEmail(email, verifyUrl);

    rl.set(email, now);
    return { ok: true, message: "Email de verificación enviado" };
  } catch (error) {
    return { ok: false, message: "Error al enviar email" };
  }
}
