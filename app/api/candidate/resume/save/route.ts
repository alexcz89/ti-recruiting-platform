// app/api/candidate/resume/save/route.ts
import { NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { z } from "zod";
import {
  TaxonomyKind,
  LanguageProficiency,
  EducationLevel,
  Prisma,
} from "@prisma/client";

/* =======================
 * Helpers
 * ======================= */
function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parseDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

const levelRank: Record<EducationLevel, number> = {
  NONE: 0,
  PRIMARY: 1,
  SECONDARY: 2,
  HIGH_SCHOOL: 3,
  TECHNICAL: 4,
  BACHELOR: 5,
  MASTER: 6,
  DOCTORATE: 7,
  OTHER: 4,
};

function highestLevel(levels: (EducationLevel | null | undefined)[]): EducationLevel {
  let best: EducationLevel = "NONE";
  for (const l of levels) if (l && levelRank[l] > levelRank[best]) best = l;
  return best;
}

function toLangLevel(input?: string): LanguageProficiency {
  const s = (input || "").toUpperCase();
  if (s.includes("NATIVE") || s.includes("NATIVO")) return "NATIVE";
  if (s.includes("PROF")) return "PROFESSIONAL";
  if (s.includes("CONVER")) return "CONVERSATIONAL";
  if (s.includes("BASIC") || s.includes("BÁSIC")) return "BASIC";
  return "CONVERSATIONAL";
}

async function ensureTerm(kind: TaxonomyKind, label: string) {
  const slug = slugify(label);
  const existing = await prisma.taxonomyTerm.findFirst({
    where: { kind, slug },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.taxonomyTerm.create({
    data: { kind, slug, label },
    select: { id: true },
  });
  return created.id;
}

/* =======================
 * Auth (NextAuth)
 * ======================= */
async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id ?? null;
}

/* =======================
 * Zod payload
 * ======================= */
const PersonalSchema = z.object({
  fullName: z.string().min(1, "Nombre requerido"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")), // ISO yyyy-mm-dd
  linkedin: z.string().optional().or(z.literal("")),
  github: z.string().optional().or(z.literal("")),
});

const EducationItem = z.object({
  institution: z.string().min(1),
  program: z.string().optional().or(z.literal("")),
  level: z.string().optional().or(z.literal("")),
  status: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  grade: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  sortIndex: z.number().int().optional(),
});

const WorkItem = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  isCurrent: z.boolean().optional(),
  // Aceptamos description en el payload, pero NO se persiste (tabla no tiene columna).
  description: z.string().optional().or(z.literal("")),
});

const SkillItem = z.object({
  name: z.string().min(1),
  level: z.number().int().min(0).max(5).optional(),
});

const LanguageItem = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
});

const CertificationItem = z.object({
  name: z.string().min(1),
  issuer: z.string().optional().or(z.literal("")),
  date: z.string().optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
  credentialId: z.string().optional().or(z.literal("")),
  url: z.string().optional().or(z.literal("")),
});

const ResumeSchema = z.object({
  personal: PersonalSchema,
  about: z.string().optional().or(z.literal("")),
  education: z.array(EducationItem).default([]),
  experience: z.array(WorkItem).default([]),
  skills: z.array(SkillItem).default([]),
  languages: z.array(LanguageItem).default([]),
  certifications: z.array(CertificationItem).default([]),
});

/* =======================
 * POST /api/candidate/resume/save
 * ======================= */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = ResumeSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { personal, about, education, experience, skills, languages, certifications } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1) USER
      const userUpdate: Prisma.UserUpdateInput = {
        name: personal.fullName,
        firstName: personal.fullName?.split(" ")?.[0] || undefined,
        phone: personal.phone || null,
        location: personal.location || null,
        birthdate: personal.birthDate ? parseDate(personal.birthDate) : null,
        linkedin: personal.linkedin || null,
        github: personal.github || null,
        // summary: about  ❌ tu tabla User no tiene este campo
      };
      await tx.user.update({ where: { id: userId }, data: userUpdate });

      // 2) EDUCATION — reemplazo completo
      await tx.education.deleteMany({ where: { userId } });
      if (education.length) {
        await tx.education.createMany({
          data: education.map((e, idx) => ({
            userId,
            institution: e.institution.trim(),
            program: e.program || null,
            level: (e.level || null) as any,
            status: ((e.status as any) || (e.endDate ? "COMPLETED" : "ONGOING")) as any,
            country: e.country || null,
            city: e.city || null,
            startDate: parseDate(e.startDate) ?? undefined,
            endDate: parseDate(e.endDate) ?? undefined,
            grade: e.grade || null,
            description: e.description || null,
            sortIndex: typeof e.sortIndex === "number" ? e.sortIndex : idx,
          })),
        });
        const levels = education.map((e) => e.level as EducationLevel | null | undefined);
        await tx.user.update({
          where: { id: userId },
          data: { highestEducationLevel: highestLevel(levels) },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { highestEducationLevel: "NONE" },
        });
      }

      // 3) EXPERIENCE — reemplazo completo
      await tx.workExperience.deleteMany({ where: { userId } });
      if (experience.length) {
        await tx.workExperience.createMany({
          data: experience.map((w) => ({
            userId,
            company: w.company.trim(),
            role: w.role.trim(),
            startDate: parseDate(w.startDate) ?? new Date(),
            endDate: parseDate(w.endDate) ?? null,
            isCurrent: !!w.isCurrent,
            // description: w.description || null, // ❌ la tabla no tiene esta columna
          })),
        });
      }

      // 4) SKILLS — reemplazo + catálogo
      await tx.candidateSkill.deleteMany({ where: { userId } });
      for (const s of skills) {
        const name = s.name.trim();
        if (!name) continue;
        const termId = await ensureTerm(TaxonomyKind.SKILL, name);
        await tx.candidateSkill.create({
          data: { userId, termId, level: typeof s.level === "number" ? s.level : null },
        });
      }

      // 5) LANGUAGES — reemplazo + catálogo
      await tx.candidateLanguage.deleteMany({ where: { userId } });
      for (const l of languages) {
        const name = l.name.trim();
        if (!name) continue;
        const termId = await ensureTerm(TaxonomyKind.LANGUAGE, name);
        await tx.candidateLanguage.create({
          data: { userId, termId, level: toLangLevel(l.level) },
        });
      }

      // 6) CERTIFICATIONS — reemplazo + catálogo
      await tx.candidateCredential.deleteMany({ where: { userId } });
      for (const c of certifications) {
        const name = c.name.trim();
        if (!name) continue;
        const termId = await ensureTerm(TaxonomyKind.CERTIFICATION, name);
        await tx.candidateCredential.create({
          data: {
            userId,
            termId,
            issuer: c.issuer || null,
            issuedAt: parseDate(c.date) ?? null,
            expiresAt: parseDate(c.expiresAt) ?? null,
            credentialId: c.credentialId || null,
            url: c.url || null,
          },
        });
      }

      const [expCount, eduCount, skillCount, langCount, certCount] = await Promise.all([
        tx.workExperience.count({ where: { userId } }),
        tx.education.count({ where: { userId } }),
        tx.candidateSkill.count({ where: { userId } }),
        tx.candidateLanguage.count({ where: { userId } }),
        tx.candidateCredential.count({ where: { userId } }),
      ]);

      return {
        counts: {
          experience: expCount,
          education: eduCount,
          skills: skillCount,
          languages: langCount,
          certifications: certCount,
        },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/candidate/resume/save] error", err);
    return NextResponse.json({ error: "Error al guardar CV" }, { status: 500 });
  }
}
