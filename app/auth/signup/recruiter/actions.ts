// app/auth/signup/recruiter/actions.ts
"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  RecruiterSimpleSignupSchema,
  type RecruiterSimpleSignupInput,
} from "@/lib/validation/recruiter/simple";
import { createEmailVerifyToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mailer";

// ---------------------------------------------------------
// Rate limit simple en memoria
// ---------------------------------------------------------
const RL_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RL_MAX = 5;
const rlStore: Map<string, number[]> =
  (globalThis as any).__signup_rl__ || new Map<string, number[]>();
(globalThis as any).__signup_rl__ = rlStore;

function rateLimit(ip: string) {
  const now = Date.now();
  const arr = (rlStore.get(ip) || []).filter((ts) => now - ts < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) return false;
  arr.push(now);
  rlStore.set(ip, arr);
  return true;
}

export type ActionState = {
  ok: boolean;
  message?: string;
  warningDomain?: boolean;
};

// ---------------------------------------------------------
// Acción principal
// ---------------------------------------------------------
export async function createRecruiterAction(
  input: RecruiterSimpleSignupInput
): Promise<ActionState> {
  try {
    // Rate limit
    const ip =
      (headers().get("x-forwarded-for") || "").split(",")[0]?.trim() || "local";
    if (!rateLimit(ip)) {
      return { ok: false, message: "Demasiados intentos. Inténtalo más tarde." };
    }

    // Validación Zod
    const data = RecruiterSimpleSignupSchema.parse(input);

    // ¿Usuario ya existe?
    const exists = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      select: { id: true },
    });
    if (exists) return { ok: false, message: "Este correo ya está registrado." };

    // Busca o crea la empresa
    let company = await prisma.company.findFirst({
      where: { name: data.companyName },
      select: { id: true },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: data.companyName,
          size: (data.size as string) ?? null,
        },
        select: { id: true },
      });
    }

    // Crea el usuario RECRUITER
    const passwordHash = await hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: `${data.firstName} ${data.lastName}`.trim(),
        passwordHash,
        role: "RECRUITER",
        // ✅ relación correcta
        company: { connect: { id: company.id } },
        // ❌ no enviar emailVerified aquí; el campo existe y queda null
      },
      select: { id: true, email: true },
    });

    // (Opcional) Perfil de reclutador (status por default = PENDING)
    await prisma.recruiterProfile
      .create({
        data: {
          userId: user.id,
          company: data.companyName,
          website: null,
          phone: "",
          // status: PENDING por default en el schema
        },
      })
      .catch(() => { /* ignora si no existe el modelo */ });

    // Token + email de verificación
    const token = await createEmailVerifyToken({ email: user.email }, 60);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(
      token
    )}`;
    await sendVerificationEmail(user.email, verifyUrl);

    return {
      ok: true,
      message: "Cuenta creada. Revisa tu correo para verificar tu email.",
    };
  } catch (err: any) {
    const msg =
      err?.message ||
      err?.errors?.[0]?.message ||
      "Error al crear la cuenta.";
    return { ok: false, message: msg };
  }
}
