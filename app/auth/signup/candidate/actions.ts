// app/auth/signup/candidate/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import {
  CandidateSignupSchema,
  type CandidateSignupInput,
} from "@/lib/validation";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";

/* ========= Tipos del borrador que viene del CV Builder ========= */
type CvDraftIdentity = {
  location?: string;
  phone?: string;
  birthdate?: string; // "YYYY-MM-DD"
  linkedin?: string;
  github?: string;
};

type CvDraftExperience = {
  role?: string;
  company?: string;
  startDate?: string | null; // "YYYY-MM"
  endDate?: string | null; // "YYYY-MM"
  isCurrent?: boolean;
  bulletsText?: string;
  descriptionHtml?: string;
};

type CvDraftEducation = {
  institution?: string;
  program?: string | null;
  startDate?: string | null; // "YYYY-MM"
  endDate?: string | null; // "YYYY-MM"
};

type CvDraftSkill = {
  termId?: string;
  label?: string;
  level?: 1 | 2 | 3 | 4 | 5;
};

type CvDraftLanguage = {
  termId?: string;
  label?: string;
  level?: "NATIVE" | "PROFESSIONAL" | "CONVERSATIONAL" | "BASIC";
};

type CvDraft = {
  identity?: CvDraftIdentity;
  experiences?: CvDraftExperience[];
  education?: CvDraftEducation[];
  skills?: CvDraftSkill[];
  languages?: CvDraftLanguage[];
};

/* ========= Helpers ========= */

function parseMonthToDate(ym?: string | null): Date | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm) return null;
  return new Date(yy, mm - 1, 1);
}

/**
 * Envía un correo de verificación.
 *
 * Está pensado para usar un proveedor tipo Resend vía HTTP.
 * - Si faltan variables de entorno, simplemente no hace nada (no truena el signup).
 * - Más adelante puedes cambiar el HTML, el proveedor o la URL sin tocar el resto del flujo.
 */
async function sendVerificationEmail(email: string, name?: string | null) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // ej: "Bolsa TI <no-reply@bolsati.mx>"
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";

  if (!apiKey || !from) {
    console.warn(
      "[signup] Falta RESEND_API_KEY o EMAIL_FROM; no se envió correo de verificación."
    );
    return;
  }

  // Generar token seguro (JWT firmado) con expiración de 60 minutos
  const { createEmailVerifyToken } = await import("@/lib/tokens");
  const token = await createEmailVerifyToken({ email }, 60);

  // URL segura con token firmado (no el email en texto plano)
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/api/auth/verify?token=${token}`;

  const firstName = (name || "").split(" ")[0] || "¡Hola!";

  const subject = "Confirma tu correo en Bolsa TI";
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding:24px;">
      <h1 style="font-size:20px; margin-bottom:12px;">${firstName}, confirma tu correo</h1>
      <p style="font-size:14px; line-height:1.5; margin-bottom:16px;">
        Gracias por crear tu cuenta en <strong>Bolsa TI</strong>.
        Antes de empezar a usarla, necesitamos confirmar que este correo es tuyo.
      </p>
      <p style="text-align:center; margin:24px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block; padding:10px 18px; border-radius:999px;
                  background:#059669; color:#ffffff; text-decoration:none; font-size:14px;">
          Verificar correo
        </a>
      </p>
      <p style="font-size:12px; color:#6b7280; line-height:1.5; margin-top:24px;">
        Si tú no creaste esta cuenta, puedes ignorar este mensaje. El enlace expira en 60 minutos.
      </p>
    </div>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error("[signup] Error enviando correo de verificación:", err);
  }
}

async function importDraftToUser(userId: string, draft: CvDraft) {
  const tx: any[] = [];

  // ---- Identidad básica al User ----
  if (draft.identity) {
    const { location, phone, birthdate, linkedin, github } = draft.identity;
    let birth: Date | null = null;
    if (birthdate) {
      const d = new Date(birthdate);
      if (!Number.isNaN(d.getTime())) birth = d;
    }

    tx.push(
      prisma.user.update({
        where: { id: userId },
        data: {
          location: location || undefined,
          phone: phone || undefined,
          linkedin: linkedin || undefined,
          github: github || undefined,
          birthdate: birth || undefined,
        },
      })
    );
  }

  // ---- Experiencia laboral ----
  if (Array.isArray(draft.experiences) && draft.experiences.length) {
    const data = draft.experiences
      .filter(
        (e) =>
          e.role ||
          e.company ||
          e.bulletsText ||
          e.descriptionHtml ||
          e.startDate ||
          e.endDate
      )
      .map((e) => {
        const start = parseMonthToDate(e.startDate);
        const end = e.isCurrent ? null : parseMonthToDate(e.endDate);

        const row: any = {
          userId,
          role: e.role || "",
          company: e.company || "",
          isCurrent: !!e.isCurrent,
        };

        if (start) row.startDate = start;
        row.endDate = end; // nullable en el modelo

        return row;
      });

    if (data.length) {
      tx.push(prisma.workExperience.createMany({ data: data as any }));
    }
  }

  // ---- Educación ----
  if (Array.isArray(draft.education) && draft.education.length) {
    const data = draft.education
      .filter((e) => e.institution)
      .map((e, index) => {
        const start = parseMonthToDate(e.startDate);
        const end = parseMonthToDate(e.endDate);

        const status =
          !end && start ? "ONGOING" : end ? "COMPLETED" : "COMPLETED";

        return {
          userId,
          institution: e.institution || "",
          program: e.program || "",
          startDate: start,
          endDate: end,
          level: "BACHELOR" as any,
          status: status as any,
          sortIndex: index,
        };
      });

    if (data.length) {
      tx.push(prisma.education.createMany({ data: data as any }));
    }
  }

  // ---- Skills ----
  if (Array.isArray(draft.skills) && draft.skills.length) {
    const data = draft.skills
      .filter((s) => s.termId && s.label && s.label.trim())
      .map((s) => ({
        userId,
        termId: s.termId as string,
        level: s.level ?? 3,
      }));

    if (data.length) {
      tx.push(
        prisma.candidateSkill.createMany({
          data: data as any,
          skipDuplicates: true,
        })
      );
    }
  }

  // ---- Idiomas ----
  if (Array.isArray(draft.languages) && draft.languages.length) {
    const data = draft.languages
      .filter((l) => l.termId && l.label && l.label.trim())
      .map((l) => ({
        userId,
        termId: l.termId as string,
        level: (l.level ?? "CONVERSATIONAL") as any,
      }));

    if (data.length) {
      tx.push(
        prisma.candidateLanguage.createMany({
          data: data as any,
          skipDuplicates: true,
        })
      );
    }
  }

  if (tx.length) {
    await prisma.$transaction(tx);
  }
}

/* ========= Acción principal ========= */

export async function createCandidateAction(
  input: CandidateSignupInput,
  rawDraft?: unknown
) {
  try {
    const data = CandidateSignupSchema.parse(input);

    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Ya existe una cuenta con este correo." };
    }

    const passwordHash = await hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
        passwordHash,
        role: "CANDIDATE" as Role,
      },
      select: { id: true, name: true, email: true },
    });

    // Intentar importar el borrador del CV (si vino algo)
    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    if (cvDraft) {
      await importDraftToUser(user.id, cvDraft);
    }

    // Enviar correo de verificación (no bloquea el flujo si falla)
    await sendVerificationEmail(user.email, data.name);

    return { ok: true, emailVerificationSent: true };
  } catch (err) {
    console.error("Error createCandidateAction", err);
    return { ok: false, error: "No se pudo crear la cuenta" };
  }
}
