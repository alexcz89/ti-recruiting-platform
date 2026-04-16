// app/auth/signup/recruiter/actions.ts
"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/server/prisma";
import { hash } from "bcryptjs";
import {
  RecruiterSimpleSignupSchema,
  type RecruiterSimpleSignupInput,
} from "@/lib/shared/validation/recruiter/simple";
import { createEmailVerifyToken } from "@/lib/server/tokens";
import { sendVerificationEmail } from "@/lib/server/mailer";
import { isFreeDomain } from "@/lib/shared/validation/recruiter/signup";
import { ensureCompanyForRecruiter } from "@/lib/company";

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
    const ip =
      (headers().get("x-forwarded-for") || "").split(",")[0]?.trim() || "local";

    if (!rateLimit(ip)) {
      return {
        ok: false,
        message: "Demasiados intentos. Inténtalo más tarde.",
      };
    }

    const data = RecruiterSimpleSignupSchema.parse(input);

    if (isFreeDomain(data.email)) {
      return {
        ok: false,
        message:
          "Usa un correo corporativo (no aceptamos dominios gratuitos como Gmail/Hotmail).",
      };
    }

    const email = data.email.toLowerCase().trim();

    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });

    if (exists) {
      if (!exists.emailVerified) {
        const token = await createEmailVerifyToken({ email: exists.email }, 60);
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(
          token
        )}`;

        await sendVerificationEmail(exists.email, verifyUrl);

        return {
          ok: true,
          message:
            "Te reenviamos el correo de verificación. Revisa tu bandeja de entrada (y carpeta spam).",
        };
      }

      return {
        ok: false,
        message: "Este correo ya está registrado.",
      };
    }

    const company = await ensureCompanyForRecruiter({
      companyName: data.companyName,
      email,
      size: data.size ?? null,
    });

    const passwordHash = await hash(data.password, 10);
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    const user = await prisma.user.create({
      data: {
        email,
        name: fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        role: "RECRUITER",
      },
      select: { id: true, email: true },
    });

    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        phone: null,
      },
    });

    const token = await createEmailVerifyToken({ email: user.email }, 60);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(
      token
    )}`;

    await sendVerificationEmail(user.email, verifyUrl);

    return {
      ok: true,
      warningDomain: false,
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