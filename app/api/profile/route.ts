// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

import {
  EducationSchema,
  EducationLevel,
} from "@/lib/schemas/profile";

/** Zod: valida los campos básicos que guardamos en User */
const ProfilePayloadSchema = z.object({
  location: z.string().min(2).optional(),
  phone: z.string().optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  resumeUrl: z.string().url().optional().or(z.literal("")),
  countryCode: z.string().min(2).max(2).optional(),
  admin1: z.string().optional(),
  city: z.string().optional(),
  cityNorm: z.string().optional(),
  admin1Norm: z.string().optional(),

  // 🔹 nuevos
  highestEducationLevel: EducationLevel.optional(),
  education: z.any().optional(), // lo validaremos con EducationSchema[]
});

/** Convierte strings vacíos a null para guardar más limpio en DB */
function nullIfEmpty(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? null : v;
}
function parseBirthdate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Ranking simple para decidir el "máximo" académico */
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
function pickHighestEducation(levels: (string | null | undefined)[] | null | undefined) {
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
}

/** Lee el body como JSON o FormData y regresa un objeto plano */
async function readPayload(req: Request) {
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    return {
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

      highestEducationLevel: form.get("highestEducationLevel")?.toString(),
      education: form.get("education")?.toString(), // JSON string
    };
  }

  const json = await req.json().catch(() => ({}));
  return {
    location: typeof json.location === "string" ? json.location : undefined,
    phone: typeof json.phone === "string" ? json.phone : undefined,
    birthdate: typeof json.birthdate === "string" ? json.birthdate : undefined,
    linkedin: typeof json.linkedin === "string" ? json.linkedin : undefined,
    github: typeof json.github === "string" ? json.github : undefined,
    resumeUrl: typeof json.resumeUrl === "string" ? json.resumeUrl : undefined,
    countryCode: typeof json.countryCode === "string" ? json.countryCode : undefined,
    admin1: typeof json.admin1 === "string" ? json.admin1 : undefined,
    city: typeof json.city === "string" ? json.city : undefined,
    cityNorm: typeof json.cityNorm === "string" ? json.cityNorm : undefined,
    admin1Norm: typeof json.admin1Norm === "string" ? json.admin1Norm : undefined,

    highestEducationLevel: typeof json.highestEducationLevel === "string" ? json.highestEducationLevel : undefined,
    education: json.education, // array o string
  };
}

export async function PATCH(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await readPayload(req);

    // Valida lo base (User)
    const parsed = ProfilePayloadSchema.parse(raw);

    // Parse/valida educación (puede venir como string JSON o como arreglo)
    let eduInput: unknown = parsed.education;
    if (typeof eduInput === "string") {
      try { eduInput = JSON.parse(eduInput); } catch { eduInput = []; }
    }
    const education = z.array(EducationSchema).parse(eduInput ?? []);

    // Normaliza educación: endDate = null si ONGOING
    const normalizedEducation = education.map((e, i) => ({
      ...e,
      startDate: e.startDate ? e.startDate.slice(0, 7) : null,
      endDate: e.status === "ONGOING" ? null : (e.endDate ? e.endDate.slice(0, 7) : null),
      sortIndex: typeof e.sortIndex === "number" ? e.sortIndex : i,
    }));

    // 🔹 Deriva nivel máximo desde la lista normalizada (si el payload no lo manda)
    const highestFromList = normalizedEducation.length
      ? pickHighestEducation(normalizedEducation.map(e => e.level as string))
      : null;

    // Prepara update de User
    const data: any = {};
    if (parsed.location !== undefined) data.location = parsed.location;
    if (parsed.phone !== undefined) data.phone = nullIfEmpty(parsed.phone);
    if (parsed.linkedin !== undefined) data.linkedin = nullIfEmpty(parsed.linkedin);
    if (parsed.github !== undefined) data.github = nullIfEmpty(parsed.github);
    if (parsed.resumeUrl !== undefined) data.resumeUrl = nullIfEmpty(parsed.resumeUrl);

    if (parsed.birthdate !== undefined) {
      const bd = parseBirthdate(parsed.birthdate || null);
      data.birthdate = bd;
    }
    if (parsed.countryCode !== undefined) data.country = parsed.countryCode;
    if (parsed.admin1 !== undefined) data.admin1 = nullIfEmpty(parsed.admin1);
    if (parsed.city !== undefined) data.city = nullIfEmpty(parsed.city);
    if (parsed.cityNorm !== undefined) data.cityNorm = nullIfEmpty(parsed.cityNorm);
    if (parsed.admin1Norm !== undefined) data.admin1Norm = nullIfEmpty(parsed.admin1Norm);

    // Si el front lo manda, se respeta; si no, lo derivamos
    if (parsed.highestEducationLevel !== undefined) {
      data.highestEducationLevel = parsed.highestEducationLevel;
    } else if (highestFromList) {
      data.highestEducationLevel = highestFromList;
    }

    // Transacción: update user + upsert educación
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { email },
        data,
        select: { id: true, email: true }
      });

      const keepIds = normalizedEducation.map(e => e.id).filter(Boolean) as string[];

      // Borra lo que no viene
      if (keepIds.length > 0) {
        await tx.education.deleteMany({
          where: { userId: user.id, id: { notIn: keepIds } },
        });
      } else {
        await tx.education.deleteMany({ where: { userId: user.id } });
      }

      // Upsert / create/update
      for (const row of normalizedEducation) {
        const eduData = {
          userId: user.id,
          level: row.level ?? null,
          status: row.status,
          institution: row.institution,
          program: row.program ?? null,
          country: row.country ?? null,
          city: row.city ?? null,
          startDate: row.startDate ? new Date(`${row.startDate}-01T00:00:00.000Z`) : null,
          endDate: row.endDate ? new Date(`${row.endDate}-01T00:00:00.000Z`) : null,
          grade: row.grade ?? null,
          description: row.description ?? null,
          sortIndex: row.sortIndex,
        };

        if (row.id) {
          await tx.education.update({
            where: { id: row.id },
            data: eduData,
          });
        } else {
          await tx.education.create({ data: eduData });
        }
      }

      // Regresa snapshot
      const full = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          location: true,
          phone: true,
          birthdate: true,
          linkedin: true,
          github: true,
          resumeUrl: true,
          country: true,
          admin1: true,
          city: true,
          cityNorm: true,
          admin1Norm: true,
          highestEducationLevel: true,
          candidateEducation: {
            orderBy: { sortIndex: "asc" },
          },
        },
      });

      return full;
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
