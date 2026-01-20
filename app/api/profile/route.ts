// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { z } from "zod";

import {
  EducationSchema,
  EducationLevel,
  LanguageSchema,
  SkillDetailedSchema,
} from "@/lib/shared/schemas/profile";

/* Helpers */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const educationRank: Record<string, number> = {
  NONE: 0,
  PRIMARY: 1,
  SECONDARY: 2,
  HIGH_SCHOOL: 3,
  TECHNICAL: 4,
  BACHELOR: 5,
  MASTER: 6,
  DOCTORATE: 7,
  OTHER: 2,
};
const pickHighestEducation = (levels?: (string | null | undefined)[]) => {
  if (!levels?.length) return null;
  let best: string | null = null;
  let bestScore = -1;
  for (const lv of levels) {
    const key = String(lv ?? "NONE").toUpperCase();
    const score = educationRank[key] ?? -1;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
};
const nullIfEmpty = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;
const parseBirthdate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};
const toMonthStartDate = (ym?: string | null) =>
  ym && MONTH_RE.test(ym) ? new Date(`${ym}-01T00:00:00.000Z`) : null;

/* Schemas */
const WorkExperienceSchema = z.object({
  id: z.string().optional(),
  role: z.string().min(1),
  company: z.string().min(1),
  startDate: z.string().regex(MONTH_RE),
  endDate: z
    .string()
    .regex(MONTH_RE)
    .optional()
    .or(z.literal(""))
    .or(z.null()),
  isCurrent: z.boolean().default(false),
});

const ProfilePayloadSchema = z.object({
  firstName: z.string().optional().or(z.literal("")),
  lastName1: z.string().optional().or(z.literal("")),
  lastName2: z.string().optional().or(z.literal("")),
  location: z.string().min(2).optional(),
  phone: z.string().optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
  linkedin: z.string().optional().or(z.literal("")),
  github: z.string().optional().or(z.literal("")),
  resumeUrl: z.string().optional().or(z.literal("")),
  countryCode: z.string().min(2).max(2).optional(),
  admin1: z.string().optional(),
  city: z.string().optional(),
  cityNorm: z.string().optional(),
  admin1Norm: z.string().optional(),
  certifications: z.string().optional(), // CSV
  experiences: z.any().optional(),
  languages: z.any().optional(),
  skillsDetailed: z.any().optional(),
  highestEducationLevel: EducationLevel.optional(),
  education: z.any().optional(),
});

/* Read payload JSON/FormData */
async function readPayload(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    return {
      firstName: form.get("firstName")?.toString(),
      lastName1: form.get("lastName1")?.toString(),
      lastName2: form.get("lastName2")?.toString(),
      location: form.get("location")?.toString(),
      phone: form.get("phone")?.toString(),
      birthdate: form.get("birthdate")?.toString(),
      linkedin: form.get("linkedin")?.toString(),
      github: form.get("github")?.toString(),
      resumeUrl: form.get("resumeUrl")?.toString(),
      countryCode: form.get("countryCode")?.toString(),
      admin1: form.get("admin1")?.toString(),
      city: form.get("city")?.toString(),
      cityNorm: form.get("cityNorm")?.toString(),
      admin1Norm: form.get("admin1Norm")?.toString(),
      certifications: form.get("certifications")?.toString(),
      experiences: form.get("experiences")?.toString(),
      languages: form.get("languages")?.toString(),
      skillsDetailed: form.get("skillsDetailed")?.toString(),
      highestEducationLevel: form.get("highestEducationLevel")?.toString(),
      education:
        form.get("educationJson")?.toString() ??
        form.get("educations")?.toString() ??
        form.get("education")?.toString(),
    };
  }
  const json: any = await req.json().catch(() => ({}));
  return {
    firstName: json.firstName,
    lastName1: json.lastName1,
    lastName2: json.lastName2,
    location: json.location,
    phone: json.phone,
    birthdate: json.birthdate,
    linkedin: json.linkedin,
    github: json.github,
    resumeUrl: json.resumeUrl,
    countryCode: json.countryCode,
    admin1: json.admin1,
    city: json.city,
    cityNorm: json.cityNorm,
    admin1Norm: json.admin1Norm,
    certifications: json.certifications,
    experiences: json.experiences,
    languages: json.languages,
    skillsDetailed: json.skillsDetailed,
    highestEducationLevel: json.highestEducationLevel,
    education: json.education ?? json.educations ?? json.educationJson,
  };
}

/* ===== GET ===== */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      birthdate: true,
      linkedin: true,
      github: true,
      resumeUrl: true,
      education: { orderBy: { sortIndex: "asc" } },
      // 👇 aquí usamos el nombre correcto de la relación
      experiences: {
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      },
      candidateLanguages: { include: { term: { select: { label: true } } } },
      candidateSkills: { include: { term: { select: { label: true } } } },
      certifications: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const resp = {
    personal: {
      fullName: user.name ?? "",
      email: user.email,
      phone: user.phone ?? "",
      location: user.location ?? "",
      birthDate: user.birthdate
        ? user.birthdate.toISOString().slice(0, 10)
        : "",
      linkedin: user.linkedin ?? "",
      github: user.github ?? "",
    },
    about: "", // tu modelo no tiene 'about'; lo dejamos vacío
    education: user.education.map((e) => ({
      institution: e.institution ?? "",
      program: e.program ?? "",
      level: (e.level as any) ?? null,
      status: (e.status as any) ?? null,
      startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : "",
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : "",
    })),
    // 👇 usamos user.experiences, no user.workExperience
    experience: user.experiences.map((w) => ({
      company: w.company,
      role: w.role,
      startDate: w.startDate ? w.startDate.toISOString().slice(0, 10) : "",
      endDate: w.endDate ? w.endDate.toISOString().slice(0, 10) : "",
      isCurrent: w.isCurrent,
    })),
    skills: user.candidateSkills.map((s) => ({
      name: s.term?.label || "",
      level: s.level,
    })),
    languages: user.candidateLanguages.map((l) => ({
      name: l.term?.label || "",
      level: l.level as any,
    })),
    certifications: (user.certifications ?? []).map((c) => ({
      name: c,
      issuer: null,
      date: "",
      url: null,
    })),
  };

  return NextResponse.json(resp);
}

/* ===== PATCH ===== */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const raw = await readPayload(req);
    const base = ProfilePayloadSchema.parse(raw);

    const parseMaybeJson = (v: unknown) => {
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return undefined;
        }
      }
      return v;
    };

    let experiences = parseMaybeJson(base.experiences);
    experiences = z.array(WorkExperienceSchema).parse(experiences ?? []);

    let languages = parseMaybeJson(base.languages);
    languages = z.array(LanguageSchema).parse(languages ?? []);

    let skillsDetailed = parseMaybeJson(base.skillsDetailed);
    skillsDetailed = z.array(SkillDetailedSchema).parse(skillsDetailed ?? []);

    let eduInput = parseMaybeJson(base.education);
    const education = z.array(EducationSchema).parse(eduInput ?? []);
    const normalizedEducation = education.map((e, i) => ({
      ...e,
      startDate: e.startDate ? e.startDate.slice(0, 7) : null,
      endDate:
        e.status === "ONGOING"
          ? null
          : e.endDate
          ? e.endDate.slice(0, 7)
          : null,
      sortIndex: typeof e.sortIndex === "number" ? e.sortIndex : i,
    }));
    const highestFromList = normalizedEducation.length
      ? pickHighestEducation(
          normalizedEducation.map((e) => e.level as string)
        )
      : null;

    const certificationsArr = (base.certifications || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const fullName = [base.firstName, base.lastName1, base.lastName2]
      .map((x) => (x || "").trim())
      .filter(Boolean)
      .join(" ");

    const dataUser: any = {};
    if (fullName) dataUser.name = fullName;
    if (base.location !== undefined) dataUser.location = base.location;
    if (base.phone !== undefined) dataUser.phone = nullIfEmpty(base.phone);
    if (base.linkedin !== undefined)
      dataUser.linkedin = nullIfEmpty(base.linkedin);
    if (base.github !== undefined) dataUser.github = nullIfEmpty(base.github);
    if (base.resumeUrl !== undefined)
      dataUser.resumeUrl = nullIfEmpty(base.resumeUrl);
    if (base.birthdate !== undefined)
      dataUser.birthdate = parseBirthdate(base.birthdate || null);
    if (base.countryCode !== undefined) dataUser.country = base.countryCode;
    if (base.admin1 !== undefined) dataUser.admin1 = nullIfEmpty(base.admin1);
    if (base.city !== undefined) dataUser.city = nullIfEmpty(base.city);
    if (base.cityNorm !== undefined)
      dataUser.cityNorm = nullIfEmpty(base.cityNorm);
    if (base.admin1Norm !== undefined)
      dataUser.admin1Norm = nullIfEmpty(base.admin1Norm);
    if (base.highestEducationLevel !== undefined) {
      dataUser.highestEducationLevel = base.highestEducationLevel;
    } else if (highestFromList) {
      dataUser.highestEducationLevel = highestFromList;
    }
    dataUser.certifications = certificationsArr;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { email },
        data: dataUser,
        select: { id: true },
      });

      // EDUCATION
      const keepEduIds = normalizedEducation
        .map((e) => e.id)
        .filter(Boolean) as string[];
      if (keepEduIds.length > 0) {
        await tx.education.deleteMany({
          where: { userId: user.id, id: { notIn: keepEduIds } },
        });
      } else {
        await tx.education.deleteMany({ where: { userId: user.id } });
      }
      for (const row of normalizedEducation) {
        const eduData = {
          userId: user.id,
          level: row.level ?? null,
          status: row.status,
          institution: row.institution,
          program: row.program ?? null,
          country: row.country ?? null,
          city: row.city ?? null,
          startDate: row.startDate ? toMonthStartDate(row.startDate) : null,
          endDate: row.endDate ? toMonthStartDate(row.endDate) : null,
          grade: row.grade ?? null,
          description: row.description ?? null,
          sortIndex: row.sortIndex,
        };
        if (row.id) {
          await tx.education.update({ where: { id: row.id }, data: eduData });
        } else {
          await tx.education.create({ data: eduData });
        }
      }

      // EXPERIENCES (usa el modelo WorkExperience en Prisma)
      const normalizedExp = (
        experiences as z.infer<typeof WorkExperienceSchema>[]
      ).map((e) => ({
        ...e,
        startDate: e.startDate || "",
        endDate: e.isCurrent ? null : e.endDate || null,
      }));
      const keepExpIds = normalizedExp
        .map((e) => e.id)
        .filter(Boolean) as string[];
      if (keepExpIds.length > 0) {
        await tx.workExperience.deleteMany({
          where: { userId: user.id, id: { notIn: keepExpIds } },
        });
      } else {
        await tx.workExperience.deleteMany({ where: { userId: user.id } });
      }
      for (const row of normalizedExp) {
        const data = {
          userId: user.id,
          role: row.role,
          company: row.company,
          startDate: toMonthStartDate(row.startDate)!,
          endDate: row.endDate ? toMonthStartDate(row.endDate) : null,
          isCurrent: !!row.isCurrent,
        };
        if (row.id) {
          await tx.workExperience.update({ where: { id: row.id }, data });
        } else {
          await tx.workExperience.create({ data });
        }
      }

      // LANGUAGES
      await tx.candidateLanguage.deleteMany({ where: { userId: user.id } });
      for (const l of languages as z.infer<typeof LanguageSchema>[]) {
        if (!l.termId) continue;
        await tx.candidateLanguage.create({
          data: { userId: user.id, termId: l.termId, level: l.level },
        });
      }

      // SKILLS
      await tx.candidateSkill.deleteMany({ where: { userId: user.id } });
      for (const s of skillsDetailed as z.infer<
        typeof SkillDetailedSchema
      >[]) {
        if (!s.termId) continue;
        await tx.candidateSkill.create({
          data: { userId: user.id, termId: s.termId, level: s.level as any },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true },
      });
    });

    return NextResponse.json({ ok: true, user: result });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
