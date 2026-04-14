// app/api/cv/route.ts
// Este endpoint es llamado por CvBuilder.tsx con PATCH /api/cv
// Guarda todos los datos del CV en los mismos modelos que usa /profile/edit
// para que profile/summary y cv/builder estén siempre sincronizados.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { z } from "zod";

/* ─── Helpers ─────────────────────────────────────────────── */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function toMonthDate(ym?: string | null): Date | null {
  if (!ym || !MONTH_RE.test(ym)) return null;
  return new Date(`${ym}-01T00:00:00.000Z`);
}

function parseBirthdate(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  return isNaN(d.getTime()) ? null : d;
}

const educationRank: Record<string, number> = {
  NONE: 0, PRIMARY: 1, SECONDARY: 2, HIGH_SCHOOL: 3,
  TECHNICAL: 4, BACHELOR: 5, MASTER: 6, DOCTORATE: 7, OTHER: 2,
};

function pickHighestEducation(levels: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const lv of levels) {
    const key = String(lv ?? "NONE").toUpperCase();
    const score = educationRank[key] ?? -1;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

/* ─── Schemas ──────────────────────────────────────────────── */
const IdentitySchema = z.object({
  firstName:  z.string().optional().default(""),
  lastName1:  z.string().optional().default(""),
  lastName2:  z.string().optional().default(""),
  email:      z.string().optional().default(""),
  phone:      z.string().optional().default(""),
  location:   z.string().optional().default(""),
  linkedin:   z.string().optional().default(""),
  github:     z.string().optional().default(""),
  birthdate:  z.string().optional().default(""),
});

const ExperienceSchema = z.object({
  id:          z.string().optional(),
  role:        z.string().default(""),
  company:     z.string().default(""),
  city:        z.string().optional().default(""),
  startDate:   z.string().optional().default(""),
  endDate:     z.string().optional().nullable(),
  isCurrent:   z.boolean().optional().default(false),
  description: z.string().optional().default(""),
  bulletsText: z.string().optional().default(""),
});

const EducationSchema = z.object({
  id:          z.string().optional(),
  institution: z.string().default(""),
  program:     z.string().optional().nullable().default(""),
  startDate:   z.string().optional().nullable().default(""),
  endDate:     z.string().optional().nullable().default(""),
  isCurrent:   z.boolean().optional().default(false),
  level:       z.string().optional().nullable(),
  sortIndex:   z.number().optional().default(0),
});

const SkillSchema = z.object({
  termId: z.string(),
  level:  z.number().int().min(1).max(5),
});

const LanguageSchema = z.object({
  termId: z.string(),
  level:  z.enum(["NATIVE", "PROFESSIONAL", "CONVERSATIONAL", "BASIC"]),
});

const CertificationSchema = z.object({
  name: z.string(),
  date: z.string().optional().default(""),
  url:  z.string().optional().default(""),
});

const BodySchema = z.object({
  identity:       IdentitySchema.optional(),
  experiences:    z.array(ExperienceSchema).optional().default([]),
  education:      z.array(EducationSchema).optional().default([]),
  skills:         z.array(SkillSchema).optional().default([]),
  languages:      z.array(LanguageSchema).optional().default([]),
  certifications: z.array(z.union([CertificationSchema, z.string()])).optional().default([]),
});

/* ─── PATCH ────────────────────────────────────────────────── */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!me) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (me.role !== "CANDIDATE") {
    return NextResponse.json({ error: "Solo candidatos pueden guardar el CV" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { identity, experiences, education, skills, languages, certifications } = parsed.data;

  /* ── Normalizar certifications (pueden venir como string[] o {name}[]) ── */
  const certStrings = (certifications || []).map((c) =>
    typeof c === "string" ? c.trim() : (c as any).name?.trim() || ""
  ).filter(Boolean);

  /* ── Normalizar experiencias ── */
  const expData = (experiences || [])
    .filter((e) => e.role.trim() || e.company.trim())
    .map((e) => ({
      userId:    me.id,
      role:      e.role.trim(),
      company:   e.company.trim(),
      startDate: toMonthDate(e.startDate),
      endDate:   e.isCurrent ? null : toMonthDate(e.endDate),
      isCurrent: !!e.isCurrent,
    }))
    .filter((e) => e.startDate !== null) as any[];

  /* ── Normalizar educación ── */
  const eduData = (education || [])
    .filter((e) => e.institution.trim() || (e.program ?? "").trim())
    .map((e, idx) => {
      const startDate = toMonthDate(e.startDate);
      const endDate   = e.isCurrent ? null : toMonthDate(e.endDate);
      const status    = endDate ? "COMPLETED" : "ONGOING";
      return {
        userId:      me.id,
        institution: e.institution.trim(),
        program:     e.program?.trim() || null,
        level:       (e.level as any) ?? "OTHER",
        status:      status as any,
        startDate,
        endDate,
        sortIndex:   e.sortIndex ?? idx,
      };
    });

  /* ── Validar termIds de skills y languages ── */
  const skillTermIds    = (skills    || []).map((s) => s.termId).filter(Boolean);
  const languageTermIds = (languages || []).map((l) => l.termId).filter(Boolean);

  const allTermIds = [...new Set([...skillTermIds, ...languageTermIds])];
  const foundTerms = allTermIds.length
    ? await prisma.taxonomyTerm.findMany({
        where: { id: { in: allTermIds } },
        select: { id: true, kind: true },
      })
    : [];
  const validTermIds = new Set(foundTerms.map((t) => t.id));

  const skillsData = (skills || [])
    .filter((s) => validTermIds.has(s.termId))
    .map((s) => ({ userId: me.id, termId: s.termId, level: s.level as any }));

  const langsData = (languages || [])
    .filter((l) => validTermIds.has(l.termId))
    .map((l) => ({ userId: me.id, termId: l.termId, level: l.level }));

  /* ── Datos personales ── */
  const fullName = [
    identity?.firstName,
    identity?.lastName1,
    identity?.lastName2,
  ].map((x) => (x || "").trim()).filter(Boolean).join(" ");

  const highestLevel = eduData.length
    ? pickHighestEducation(eduData.map((e) => e.level))
    : undefined;

  /* ── Transacción ── */
  try {
    await prisma.$transaction(async (tx) => {
      /* Datos personales */
      if (identity) {
        const userData: any = {
          profileLastUpdated: new Date(),
          certifications: certStrings,
        };
        if (fullName)             userData.name           = fullName;
        if (identity.firstName)   userData.firstName      = identity.firstName.trim();
        if (identity.lastName1)   userData.lastName       = identity.lastName1.trim();
        if (identity.lastName2 !== undefined) userData.maternalSurname = identity.lastName2.trim() || null;
        if (identity.phone)       userData.phone          = identity.phone.trim() || null;
        if (identity.location)    userData.location       = identity.location.trim() || null;
        if (identity.linkedin)    userData.linkedin       = identity.linkedin.trim() || null;
        if (identity.github)      userData.github         = identity.github.trim() || null;
        if (identity.birthdate)   userData.birthdate      = parseBirthdate(identity.birthdate);
        if (highestLevel)         userData.highestEducationLevel = highestLevel;

        await tx.user.update({ where: { id: me.id }, data: userData });
      }

      /* Experiencias — reemplazar todo */
      await tx.workExperience.deleteMany({ where: { userId: me.id } });
      if (expData.length) {
        await tx.workExperience.createMany({ data: expData });
      }

      /* Educación — reemplazar todo */
      await tx.education.deleteMany({ where: { userId: me.id } });
      if (eduData.length) {
        await tx.education.createMany({ data: eduData });
      }

      /* Skills — reemplazar todo */
      await tx.candidateSkill.deleteMany({ where: { userId: me.id } });
      if (skillsData.length) {
        await tx.candidateSkill.createMany({ data: skillsData });
      }

      /* Idiomas — reemplazar todo */
      await tx.candidateLanguage.deleteMany({ where: { userId: me.id } });
      if (langsData.length) {
        await tx.candidateLanguage.createMany({ data: langsData });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[PATCH /api/cv]", e);
    return NextResponse.json(
      { error: "Error al guardar el CV", detail: e?.message },
      { status: 500 }
    );
  }
}