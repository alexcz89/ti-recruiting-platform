// app/auth/signup/candidate/actions.ts
"use server";

import { prisma } from "@/lib/server/prisma";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { createEmailVerifyToken } from "@/lib/server/tokens";
import { sendVerificationEmail as sendVerificationEmailBase } from "@/lib/server/mailer";

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
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
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

/**
 * ✅ Parse "YYYY-MM" format to Date in UTC
 * Ensures consistent timezone handling across all servers
 */
function parseMonthToDate(ym?: string | null): Date | null {
  if (!ym) return null;
  const [y, m] = ym.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (!yy || !mm) return null;
  // ✅ Use UTC explicitly to avoid timezone issues
  return new Date(Date.UTC(yy, mm - 1, 1));
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parse location string when autocomplete data is unavailable.
 * Expected formats:
 * - "Ciudad de M\u00e9xico" \u2192 { city: "Ciudad de M\u00e9xico" }
 * - "Ciudad de M\u00e9xico, CDMX, MX" \u2192 { city: "Ciudad de M\u00e9xico", admin1: "CDMX", country: "MX" }
 * - "Ciudad de M\u00e9xico, Mexico" \u2192 { city: "Ciudad de M\u00e9xico", country: "Mexico" }
 */
function parseLocationString(locationStr: string): {
  city: string | null;
  admin1: string | null;
  country: string | null;
  cityNorm: string | null;
  admin1Norm: string | null;
} {
  const parts = locationStr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let city: string | null = null;
  let admin1: string | null = null;
  let country: string | null = null;

  // \u2705 Primera parte siempre es la ciudad
  if (parts.length >= 1) {
    city = parts[0];
  }

  // \u2705 L\u00f3gica mejorada para admin1/country
  if (parts.length === 2) {
    // "Ciudad, Estado" o "Ciudad, Pa\u00eds"
    const secondPart = parts[1];
    // Si es corto (2-3 chars), probablemente es estado
    if (secondPart.length <= 3) {
      admin1 = secondPart;
    } else {
      country = secondPart;
    }
  } else if (parts.length >= 3) {
    // "Ciudad, Estado, Pa\u00eds"
    admin1 = parts[1];
    country = parts[parts.length - 1]; // \u00daltima parte es pa\u00eds
  }

  const cityNorm = city ? normalize(city) : null;
  const admin1Norm = admin1 ? normalize(admin1) : null;

  return { city, admin1, country, cityNorm, admin1Norm };
}

/**
 * ✅ Envía email de verificación con retry logic (3 intentos con exponential backoff)
 */
async function sendCandidateVerificationEmail(
  email: string,
  _firstName?: string,
  retryCount = 0,
  maxRetries = 3
) {
  try {
    const baseUrl = (
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");

    const token = await createEmailVerifyToken({ email }, 60);
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(
      token
    )}`;

    await sendVerificationEmailBase(email, verifyUrl);
  } catch (err) {
    // ✅ Si hay reintentos disponibles, esperar y reintentar
    if (retryCount < maxRetries) {
      const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.warn(
        `[sendCandidateVerificationEmail] Intento ${retryCount + 1} falló. Reintentando en ${delayMs}ms...`,
        err
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return sendCandidateVerificationEmail(email, _firstName, retryCount + 1, maxRetries);
    }

    // ✅ Si se agotaron los reintentos, loguear pero no fallar el signup
    console.error(
      `[sendCandidateVerificationEmail] Error enviando email a ${email} después de ${maxRetries} intentos:`,
      err
    );

    // No lanzar error para no bloquear el signup completo
    // El usuario podrá solicitar reenvío desde /auth/verify/check-email
  }
}

async function importDraftToUser(userId: string, draft: CvDraft, txClient?: any) {
  const tx: any[] = [];
  const prismaClient = txClient || prisma;

  if (draft.identity) {
    const { location, phone, birthdate, linkedin, github } = draft.identity;
    let birth: Date | null = null;
    if (birthdate) {
      const d = new Date(birthdate);
      if (!Number.isNaN(d.getTime())) birth = d;
    }

    tx.push(
      prismaClient.user.update({
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
      tx.push(prismaClient.workExperience.createMany({ data: data as any }));
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
      tx.push(prismaClient.education.createMany({ data: data as any }));
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
        prismaClient.candidateSkill.createMany({
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
        prismaClient.candidateLanguage.createMany({
          data: data as any,
          skipDuplicates: true,
        })
      );
    }
  }

  if (tx.length && !txClient) {
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

    // ✅ Si LocationAutocomplete devolvió los campos parseados, usarlos
    // ✅ Si no (usuario escribió manualmente), parsear la string
    if (data.location && !city) {
      const parsed = parseLocationString(data.location);
      city = parsed.city;
      admin1 = parsed.admin1;
      country = parsed.country;
      cityNorm = parsed.cityNorm;
      admin1Norm = parsed.admin1Norm;
    }

    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    // ✅ Wrap user creation + draft import in transaction to ensure rollback if draft fails
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: data.role as Role,
          firstName: data.firstName,
          lastName: data.lastName,
          maternalSurname: data.maternalSurname || null,
          name: [data.firstName, data.lastName, data.maternalSurname]
            .filter(Boolean)
            .join(" "),
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
          signupSource: "organic",
          signupDevice: "web",
        },
        select: { id: true, firstName: true, email: true },
      });

      if (cvDraft) {
        await importDraftToUser(newUser.id, cvDraft, tx);
      }

      return newUser;
    });

    await sendCandidateVerificationEmail(user.email, data.firstName);

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

    const nameParts = data.name.split(" ");
    const firstName = nameParts[0] || data.name;
    const lastName = nameParts.slice(1).join(" ") || "";

    let cvDraft: CvDraft | null = null;
    if (rawDraft && typeof rawDraft === "object") {
      cvDraft = rawDraft as CvDraft;
    }

    // ✅ Wrap user creation + draft import in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
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

      if (cvDraft) {
        await importDraftToUser(newUser.id, cvDraft, tx);
      }

      return newUser;
    });

    await sendCandidateVerificationEmail(user.email, firstName);

    return { ok: true, emailVerificationSent: true };
  } catch (err) {
    console.error("Error createCandidateAction", err);
    return { ok: false, error: "No se pudo crear la cuenta" };
  }
}