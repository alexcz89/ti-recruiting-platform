// app/api/candidate/resume/save/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { z } from "zod";
import {
  TaxonomyKind,
  LanguageProficiency,
  EducationLevel,
  Prisma,
} from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

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
  const normalized = /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d;
  const dt = new Date(normalized);
  return Number.isNaN(dt.getTime()) ? null : dt;
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
  for (const l of levels) {
    if (l && levelRank[l] > levelRank[best]) best = l;
  }
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

async function ensureTermTx(
  tx: Prisma.TransactionClient,
  kind: TaxonomyKind,
  label: string
) {
  const normalized = label.trim();
  const slug = slugify(normalized);

  const existing = await tx.taxonomyTerm.findFirst({
    where: { kind, slug },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.taxonomyTerm.create({
    data: { kind, slug, label: normalized },
    select: { id: true },
  });
  return created.id;
}

/* =======================
 * Auth (NextAuth)
 * ======================= */
async function requireUserIdOrThrow(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? null;
  if (!userId) throw new Error("UNAUTHORIZED");
  return String(userId);
}

/* =======================
 * Zod payload
 * ======================= */
const PersonalSchema = z.object({
  fullName: z.string().min(1, "Nombre requerido"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
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
    const userId = await requireUserIdOrThrow();

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return jsonNoStore({ error: "Payload inválido" }, 400);
    }

    const parsed = ResumeSchema.safeParse(json);
    if (!parsed.success) {
      return jsonNoStore(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        400
      );
    }

    const { personal, about, education, experience, skills, languages, certifications } =
      parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const userUpdate: Prisma.UserUpdateInput = {
        name: personal.fullName.trim(),
        firstName: personal.fullName.trim().split(" ")[0] || undefined,
        phone: personal.phone || null,
        location: personal.location || null,
        birthdate: personal.birthDate ? parseDate(personal.birthDate) : null,
        linkedin: personal.linkedin || null,
        github: personal.github || null,
      };

      await tx.user.update({
        where: { id: userId },
        data: userUpdate,
      });

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

        const levels = education.map(
          (e) => e.level as EducationLevel | null | undefined
        );
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

      await tx.workExperience.deleteMany({ where: { userId } });
      if (experience.length) {
        await tx.workExperience.createMany({
          data: experience
            .map((w) => ({
              userId,
              company: w.company.trim(),
              role: w.role.trim(),
              startDate: parseDate(w.startDate) ?? new Date(),
              endDate: parseDate(w.endDate) ?? null,
              isCurrent: !!w.isCurrent,
              description: w.description?.trim() || null,
            }))
            .filter((w) => w.company && w.role),
        });
      }

      await tx.candidateSkill.deleteMany({ where: { userId } });
      for (const s of skills) {
        const name = s.name.trim();
        if (!name) continue;
        const termId = await ensureTermTx(tx, TaxonomyKind.SKILL, name);
        await tx.candidateSkill.create({
          data: {
            userId,
            termId,
            level: typeof s.level === "number" ? s.level : null,
          },
        });
      }

      await tx.candidateLanguage.deleteMany({ where: { userId } });
      for (const l of languages) {
        const name = l.name.trim();
        if (!name) continue;
        const termId = await ensureTermTx(tx, TaxonomyKind.LANGUAGE, name);
        await tx.candidateLanguage.create({
          data: {
            userId,
            termId,
            level: toLangLevel(l.level),
          },
        });
      }

      await tx.candidateCredential.deleteMany({ where: { userId } });
      for (const c of certifications) {
        const name = c.name.trim();
        if (!name) continue;
        const termId = await ensureTermTx(tx, TaxonomyKind.CERTIFICATION, name);
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

    return jsonNoStore({ ok: true, ...result });
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      return jsonNoStore({ error: "No autenticado" }, 401);
    }

    console.error("[POST /api/candidate/resume/save] error", err);
    return jsonNoStore({ error: "Error al guardar CV" }, 500);
  }
}