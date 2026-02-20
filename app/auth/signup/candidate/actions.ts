// app/auth/signup/candidate/actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";
import { z } from 'zod';

const ImprovedSignupSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  maternalSurname: z.string().max(50).optional(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100),
  phone: z.string().optional(),
  location: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  placeId: z.string().optional(),
  city: z.string().optional(),
  admin1: z.string().optional(),
  country: z.string().optional(),
  cityNorm: z.string().optional(),
  admin1Norm: z.string().optional(),
  linkedin: z.string().url().optional(),
  github: z.string().url().optional(),
  role: z.enum(['CANDIDATE', 'RECRUITER']).default('CANDIDATE'),
});

type ImprovedSignupInput = z.infer<typeof ImprovedSignupSchema>;

const LegacySignupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

type LegacySignupInput = z.infer<typeof LegacySignupSchema>;

type CvDraftIdentity = {
  location?: string;
  phone?: string;
  birthdate?: string;
  linkedin?: string;
  github?: string;
};

type CvDraftExperience = {
  role?: string;
  company?: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  bulletsText?: string;
  descriptionHtml?: string;
};

type CvDraftEducation = {
  institution?: string;
  program?: string | null;
  startDate?: string | null;
  endDate?: string | null;
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

function parseMonthToDate(ym?: string | null): Date | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm) return null;
  return new Date(yy, mm - 1, 1);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Envía email de verificación
 */
async function sendVerificationEmail(email: string, firstName?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // 👇 FIX: priorizar NEXTAUTH_URL que es la variable correcta en producción
  const baseUrl = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  if (!apiKey || !from) {
    console.warn(
      "[signup] Falta RESEND_API_KEY o EMAIL_FROM; no se envió correo de verificación."
    );
    return;
  }

  const { createEmailVerifyToken } = await import("@/lib/server/tokens");
  const token = await createEmailVerifyToken({ email }, 60);

  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  const name = firstName || "¡Hola!";

  const subject = "Confirma tu correo en Bolsa TI";
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding:24px;">
      <h1 style="font-size:20px; margin-bottom:12px;">${name}, confirma tu correo</h1>
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
        row.endDate = end;
        return row;
      });

    if (data.length) {
      tx.push(prisma.workExperience.createMany({ data: data as any }));
    }
  }

  if (Array.isArray(draft.education) && draft.education.length) {
    const data = draft.education
      .filter((e) => e.institution)
      .map((e, index) => {
        const start = parseMonthToDate(e.startDate);
        const end = parseMonthToDate(e.endDate);
        const status = !end && start ? "ONGOING" : end ? "COMPLETED" : "COMPLETED";
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

export async function createCandidateImproved(
  input: Partial<ImprovedSignupInput>,
  rawDraft?: unknown
) {
  try {
    const data = ImprovedSignupSchema.parse(input);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Ya existe una cuenta con este correo." };
    }

    const passwordHash = await hash(data.password, 10);

    let city = data.city || null;
    let admin1 = data.admin1 || null;
    let country = data.country || null;
    let cityNorm = data.cityNorm || null;
    let admin1Norm = data.admin1Norm || null;

    if (data.location && !city) {
      const parts = data.location.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 1) city = parts[0];
      if (parts.length >= 3) admin1 = parts[parts.length - 2];
      else if (parts.length === 2) admin1 = parts[1];
      cityNorm = city
        ? city.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
        : null;
      admin1Norm = admin1
        ? admin1.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
        : null;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: data.role as Role,
        firstName: data.firstName,
        lastName: data.lastName,
        maternalSurname: data.maternalSurname || null,
        name: [data.firstName, data.lastName, data.maternalSurname]
          .filter(Boolean)
          .join(' '),
        phone: data.phone || null,
        location: data.location || null,
        locationLat: data.locationLat || null,
        locationLng: data.locationLng || null,
        placeId: data.placeId || null,
        country: country,
        admin1: admin1,
        city: city,
        cityNorm: cityNorm,
        admin1Norm: admin1Norm,
        linkedin: data.linkedin || null,
        github: data.github || null,
        onboardingStep: 3,
        profileCompleted: !!(data.phone && data.location),
        profileCompletion: calculateProfileCompletion(data),
        signupSource: 'organic',
        signupDevice: 'web',
      },
      select: { id: true, firstName: true, email: true },
    });

    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    if (cvDraft) {
      await importDraftToUser(user.id, cvDraft);
    }

    await sendVerificationEmail(user.email, data.firstName);

    return { ok: true, emailVerificationSent: true };
  } catch (err) {
    console.error("Error createCandidateImproved", err);
    return { ok: false, error: "No se pudo crear la cuenta" };
  }
}

function calculateProfileCompletion(data: Partial<ImprovedSignupInput>): number {
  let completed = 0;
  const total = 8;
  completed += 3;
  if (data.phone) completed++;
  if (data.location) completed++;
  if (data.linkedin) completed++;
  if (data.github) completed++;
  if (data.maternalSurname) completed++;
  return Math.round((completed / total) * 100);
}

export async function createCandidateAction(
  input: LegacySignupInput,
  rawDraft?: unknown
) {
  try {
    const data = LegacySignupSchema.parse(input);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "Ya existe una cuenta con este correo." };
    }

    const passwordHash = await hash(data.password, 10);

    const nameParts = data.name.split(' ');
    const firstName = nameParts[0] || data.name;
    const lastName = nameParts.slice(1).join(' ') || '';

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name,
        firstName,
        lastName,
        passwordHash,
        role: "CANDIDATE" as Role,
        onboardingStep: 1,
        profileCompleted: false,
      },
      select: { id: true, name: true, email: true },
    });

    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    if (cvDraft) {
      await importDraftToUser(user.id, cvDraft);
    }

    await sendVerificationEmail(user.email, firstName);

    return { ok: true, emailVerificationSent: true };
  } catch (err) {
    console.error("Error createCandidateAction", err);
    return { ok: false, error: "No se pudo crear la cuenta" };
  }
}