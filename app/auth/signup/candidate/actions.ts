// app/auth/signup/candidate/actions.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
// ⬇️ Usa import relativo para evitar problemas con el alias @ en Windows
import { candidateSignupSchema } from "../../../../lib/validation/candidate";
import { createEmailVerifyToken } from "../../../../lib/tokens";
import { sendVerificationEmail } from "@/lib/mailer";

export async function createCandidateAction(input: z.infer<typeof candidateSignupSchema>) {
  try {
    // Validación Zod (normaliza name/email)
    const data = candidateSignupSchema.parse(input);
    const email = data.email.toLowerCase().trim();

    // ¿Existe ya?
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { error: "Este correo ya está registrado" };

    // Hash seguro
    const passwordHash = await hash(data.password, 10);

    // Crear usuario CANDIDATE
    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        role: "CANDIDATE",
        emailVerified: null,
      },
      select: { id: true, email: true },
    });

    // Token + enlace de verificación
    const token = await createEmailVerifyToken({ email: newUser.email }, 60);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

    // Enviar verificación (o loggear en consola si EMAIL_ENABLED !== "true")
    await sendVerificationEmail(newUser.email, verifyUrl);

    return { ok: true, id: newUser.id };
  } catch (e: any) {
    // Errores de validación Zod regresan con mensaje útil
    if (e instanceof z.ZodError) {
      return { error: e.errors?.[0]?.message || "Datos inválidos" };
    }
    // Prisma unique, etc.
    if (e?.code === "P2002") return { error: "Este correo ya está registrado" };
    return { error: e?.message || "Error inesperado" };
  }
}
