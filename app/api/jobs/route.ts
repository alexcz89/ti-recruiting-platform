// app/api/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { syncJobSkills } from "@/lib/server/syncJobSkills";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/server/session";
import { PLANS, type PlanId } from "@/config/plans";
import {
  EmploymentType,
  JobStatus,
  EducationLevel,
  LocationType,
  type Prisma,
} from "@prisma/client";

type JobSkillInput = {
  name?: string;
  required?: boolean;
  weight?: number;
};

const LOCATION_TYPE_VALUES = ["ONSITE", "HYBRID", "REMOTE"] as const;
const EMPLOYMENT_TYPE_VALUES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
] as const;
const EDUCATION_LEVEL_VALUES = [
  "NONE",
  "PRIMARY",
  "SECONDARY",
  "HIGH_SCHOOL",
  "TECHNICAL",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "OTHER",
] as const;

/* -------------------------------------------------
   Helpers
--------------------------------------------------*/
function getFormString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return (typeof v === "string" ? v : v?.toString() || "").trim();
}

function getFormNumber(fd: FormData, key: string): number | null {
  const v = getFormString(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getFormBool(fd: FormData, key: string): boolean {
  const v = getFormString(fd, key).toLowerCase();
  return (
    v === "true" ||
    v === "1" ||
    v === "on" ||
    v === "yes" ||
    v === "sí" ||
    v === "si"
  );
}

function getFormJSON<T>(fd: FormData, key: string): T | null {
  const raw = getFormString(fd, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isLocationType(value: string): value is LocationType {
  return LOCATION_TYPE_VALUES.includes(
    value as (typeof LOCATION_TYPE_VALUES)[number]
  );
}

function isEmploymentType(value: string): value is EmploymentType {
  return EMPLOYMENT_TYPE_VALUES.includes(
    value as (typeof EMPLOYMENT_TYPE_VALUES)[number]
  );
}

function isEducationLevel(value: string): value is EducationLevel {
  return EDUCATION_LEVEL_VALUES.includes(
    value as (typeof EDUCATION_LEVEL_VALUES)[number]
  );
}

function normalizeEducationLevel(value: string): EducationLevel | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
 
  // Normalizar: uppercase + quitar acentos para comparación robusta
  const normalized = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // elimina diacríticos
 
  const aliases: Record<string, EducationLevel> = {
    // Valores del enum directo
    NONE: "NONE",
    PRIMARY: "PRIMARY",
    SECONDARY: "SECONDARY",
    HIGH_SCHOOL: "HIGH_SCHOOL",
    HIGHSCHOOL: "HIGH_SCHOOL",
    TECHNICAL: "TECHNICAL",
    TECH: "TECHNICAL",
    ASSOCIATE: "TECHNICAL",
    BACHELOR: "BACHELOR",
    MASTER: "MASTER",
    DOCTORATE: "DOCTORATE",
    PHD: "DOCTORATE",
    OTHER: "OTHER",
 
    // Español sin acentos (resultado del normalize NFD)
    NINGUNO: "NONE",
    PRIMARIA: "PRIMARY",
    SECUNDARIA: "SECONDARY",
    BACHILLERATO: "HIGH_SCHOOL",
    TECNICO: "TECHNICAL",
    TECNICA: "TECHNICAL",
    "LICENCIATURA / INGENIERIA": "BACHELOR",  // ← el bug: í → i después del normalize
    "LICENCIATURA / INGENIERA": "BACHELOR",   // variante
    LICENCIATURA: "BACHELOR",
    INGENIERIA: "BACHELOR",
    INGENIERO: "BACHELOR",
    MAESTRIA: "MASTER",
    DOCTORADO: "DOCTORATE",
    OTRO: "OTHER",
 
    // Por si el frontend manda solo el número o abreviatura
    "0": "NONE",
    "1": "PRIMARY",
    "2": "SECONDARY",
    "3": "HIGH_SCHOOL",
    "4": "TECHNICAL",
    "5": "BACHELOR",
    "6": "MASTER",
    "7": "DOCTORATE",
  };
 
  // Primero intentar con el valor normalizado (sin acentos, uppercase)
  if (aliases[normalized]) return aliases[normalized];
 
  // Si ya es un valor válido del enum, usarlo directamente
  const EDUCATION_LEVEL_VALUES = [
    "NONE", "PRIMARY", "SECONDARY", "HIGH_SCHOOL", "TECHNICAL",
    "BACHELOR", "MASTER", "DOCTORATE", "OTHER",
  ];
  if (EDUCATION_LEVEL_VALUES.includes(normalized as EducationLevel)) {
    return normalized as EducationLevel;
  }
 
  // Fallback: buscar parcialmente (ej. "LICENCIATURA" dentro de "LICENCIATURA / INGENIERIA")
  if (normalized.includes("LICENCIATURA") || normalized.includes("INGENIERIA")) return "BACHELOR";
  if (normalized.includes("MAESTRIA")) return "MASTER";
  if (normalized.includes("DOCTORADO")) return "DOCTORATE";
  if (normalized.includes("BACHILLERATO") || normalized.includes("PREPARATORIA") || normalized.includes("PREPA")) return "HIGH_SCHOOL";
  if (normalized.includes("TECNICO") || normalized.includes("TECNICA")) return "TECHNICAL";
  if (normalized.includes("SECUNDARIA")) return "SECONDARY";
  if (normalized.includes("PRIMARIA")) return "PRIMARY";
 
  // Valor no reconocido → undefined activa el 400 (comportamiento correcto para valores basura)
  return undefined;
}

/* -------------------------------------------------
   GET /api/jobs
--------------------------------------------------*/
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    /* ---------- Detalle por ID ---------- */
    const id = searchParams.get("id");
    if (id) {
      const job = await prisma.job.findFirst({
        where: { id, status: JobStatus.OPEN },
        select: {
          id: true,
          title: true,
          location: true,
          locationType: true,
          locationLat: true,
          locationLng: true,
          country: true,
          admin1: true,
          city: true,
          remote: true,
          employmentType: true,
          description: true,
          descriptionHtml: true,
          skills: true,
          skillsJson: true,
          educationJson: true,
          minDegree: true,
          certsJson: true,
          benefitsJson: true,
          showBenefits: true,
          schedule: true,
          salaryMin: true,
          salaryMax: true,
          showSalary: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          companyConfidential: true,
          company: { select: { name: true, logoUrl: true } },
        },
      });

      if (!job) return NextResponse.json({ job: null });

      const companyObj = job.companyConfidential
        ? null
        : job.company
          ? {
              name: job.company.name ?? null,
              logoUrl: job.company.logoUrl ?? null,
            }
          : null;

      return NextResponse.json({
        job: {
          id: job.id,
          title: job.title,
          company: job.companyConfidential
            ? "Confidencial"
            : companyObj?.name ?? null,
          companyObj,
          companyLogoUrl: job.companyConfidential
            ? null
            : companyObj?.logoUrl ?? null,
          logoUrl: job.companyConfidential
            ? null
            : companyObj?.logoUrl ?? null,

          location: job.location,
          locationType: job.locationType,
          locationLat: job.locationLat,
          locationLng: job.locationLng,
          country: job.country,
          admin1: job.admin1,
          city: job.city,
          remote: job.remote,
          employmentType: job.employmentType,

          description: job.description,
          descriptionHtml: job.descriptionHtml,

          skills: job.skills,
          skillsJson: job.skillsJson,
          educationJson: job.educationJson,
          minDegree: job.minDegree,
          certsJson: job.certsJson,
          benefitsJson: job.benefitsJson,
          showBenefits: job.showBenefits,
          schedule: job.schedule,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          showSalary: job.showSalary,
          currency: job.currency,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          companyConfidential: job.companyConfidential,
        },
      });
    }

    /* ---------- Listado ---------- */
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const cursor = searchParams.get("cursor") ?? undefined;

    const q = (searchParams.get("q") || "").trim();
    const location = (searchParams.get("location") || "").trim();
    const remoteParam = searchParams.get("remote");

    const remote =
      remoteParam === "true"
        ? true
        : remoteParam === "false"
          ? false
          : undefined;

    const employmentTypeParam = (searchParams.get("employmentType") || "").trim();
    const employmentType = isEmploymentType(employmentTypeParam)
      ? employmentTypeParam
      : undefined;

    const sort =
      (searchParams.get("sort") as "recent" | "updated") || "recent";

    const andFilters: Prisma.JobWhereInput[] = [{ status: JobStatus.OPEN }];

    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { skills: { hasSome: [q] } },
        ],
      });
    }

    if (location) {
      andFilters.push({
        OR: [
          { location: { contains: location, mode: "insensitive" } },
          { city: { contains: location, mode: "insensitive" } },
          { admin1: { contains: location, mode: "insensitive" } },
          { country: { contains: location, mode: "insensitive" } },
        ],
      });
    }

    if (remote !== undefined) {
      andFilters.push({ remote });
    }

    if (employmentType) {
      andFilters.push({ employmentType });
    }

    const where: Prisma.JobWhereInput =
      andFilters.length === 1 ? andFilters[0] : { AND: andFilters };

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }];

    const page = await prisma.job.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        location: true,
        locationType: true,
        country: true,
        admin1: true,
        city: true,
        remote: true,
        employmentType: true,
        description: true,
        descriptionHtml: true,
        skills: true,
        salaryMin: true,
        salaryMax: true,
        showSalary: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        companyConfidential: true,
        company: { select: { name: true, logoUrl: true } },
      },
    });

    const items = page.slice(0, limit).map((j) => {
      const companyObj = j.companyConfidential
        ? null
        : j.company
          ? { name: j.company.name ?? null, logoUrl: j.company.logoUrl ?? null }
          : null;

      return {
        id: j.id,
        title: j.title,
        company: j.companyConfidential
          ? "Confidencial"
          : companyObj?.name ?? null,
        companyObj,
        companyLogoUrl: j.companyConfidential
          ? null
          : companyObj?.logoUrl ?? null,
        logoUrl: j.companyConfidential
          ? null
          : companyObj?.logoUrl ?? null,
        location: j.location,
        locationType: j.locationType,
        country: j.country,
        admin1: j.admin1,
        city: j.city,
        remote: j.remote,
        employmentType: j.employmentType,
        description: j.description,
        descriptionHtml: j.descriptionHtml,
        skills: j.skills,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        showSalary: j.showSalary,
        currency: j.currency,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        companyConfidential: j.companyConfidential,
      };
    });

    let nextCursor: string | null = null;
    if (page.length > limit) nextCursor = page[limit].id;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------
   POST /api/jobs — Crear vacante
--------------------------------------------------*/
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();

    const role = session.user?.role as
      | "RECRUITER"
      | "ADMIN"
      | string
      | undefined;

    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user?.id as string) || "";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();

    const incomingJobId = getFormString(formData, "jobId");
    if (incomingJobId) {
      return NextResponse.json(
        {
          error:
            "Esta operación es de edición. Usa el endpoint de actualización.",
        },
        { status: 409 }
      );
    }

    /* ---------- Campos ---------- */
    const title = getFormString(formData, "title");
    const description = getFormString(formData, "description");
    const descriptionHtml = getFormString(formData, "descriptionHtml");

    if (!title || !description) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const rawLocationType = getFormString(formData, "locationType") || "ONSITE";
    if (!isLocationType(rawLocationType)) {
      return NextResponse.json(
        { error: "locationType inválido" },
        { status: 400 }
      );
    }
    const locationType: LocationType = rawLocationType;

    const rawEmploymentType =
      getFormString(formData, "employmentType") || "FULL_TIME";
    if (!isEmploymentType(rawEmploymentType)) {
      return NextResponse.json(
        { error: "employmentType inválido" },
        { status: 400 }
      );
    }
    const employmentType: EmploymentType = rawEmploymentType;

    const rawMinDegree = getFormString(formData, "minDegree");
    const normalizedMinDegree = normalizeEducationLevel(rawMinDegree);

    if (normalizedMinDegree === undefined) {
      return NextResponse.json(
        { error: "minDegree inválido" },
        { status: 400 }
      );
    }

    const minDegree = normalizedMinDegree;

    const city = getFormString(formData, "city");
    const country = getFormString(formData, "country") || null;
    const admin1 = getFormString(formData, "admin1") || null;
    const cityNorm = getFormString(formData, "cityNorm") || null;
    const admin1Norm = getFormString(formData, "admin1Norm") || null;

    const locationLat = getFormNumber(formData, "locationLat");
    const locationLng = getFormNumber(formData, "locationLng");

    const safeLat = Number.isFinite(locationLat as number)
      ? (locationLat as number)
      : null;
    const safeLng = Number.isFinite(locationLng as number)
      ? (locationLng as number)
      : null;

    const remote = locationType === "REMOTE";

    const currency = getFormString(formData, "currency") || "MXN";
    const salaryMin = getFormNumber(formData, "salaryMin");
    const salaryMax = getFormNumber(formData, "salaryMax");
    const showSalary = getFormBool(formData, "showSalary");

    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return NextResponse.json(
        { error: "El sueldo mínimo no puede ser mayor que el sueldo máximo." },
        { status: 400 }
      );
    }

    const schedule = getFormString(formData, "schedule") || null;
    const showBenefits = getFormBool(formData, "showBenefits");
    const benefitsJson = getFormJSON<Prisma.JsonValue>(formData, "benefitsJson");

    const educationJson = getFormJSON<Prisma.JsonValue>(formData, "educationJson");
    const skillsJson = getFormJSON<JobSkillInput[]>(formData, "skillsJson");
    const certsJson = getFormJSON<Prisma.JsonValue>(formData, "certsJson");

    const skillsList: string[] = Array.isArray(skillsJson)
      ? skillsJson
          .map((s) =>
            typeof s?.name === "string"
              ? `${s.required ? "Req" : "Dese"}: ${s.name}`
              : ""
          )
          .filter(Boolean)
      : [];

    const companyMode = getFormString(formData, "companyMode");
    const companyConfidential = companyMode === "confidential";

    /* -------------------------------------------------
       🔁 ANTI-DUPLICADOS
    --------------------------------------------------*/
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

    const existing = await prisma.job.findFirst({
      where: {
        status: JobStatus.OPEN,
        title,
        companyId,
        recruiterId: userId,
        createdAt: { gte: threeMinutesAgo },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        id: existing.id,
        deduped: true,
      });
    }

    /* -------------------------------------------------
       🔐 LÍMITE DE VACANTES POR PLAN
    --------------------------------------------------*/
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { billingPlan: true },
    });

    const billingPlan = (company?.billingPlan as PlanId | undefined) ?? "FREE";

    const plan =
      PLANS.find((p) => p.id === billingPlan) ??
      PLANS.find((p) => p.id === "FREE") ??
      PLANS[0];

    const maxActiveJobs = plan.limits.maxActiveJobs;

    const activeJobsCount = await prisma.job.count({
      where: { companyId, status: JobStatus.OPEN },
    });

    if (maxActiveJobs !== null && activeJobsCount >= maxActiveJobs) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de ${maxActiveJobs} vacantes activas para tu plan (${plan.name}).`,
          code: "PLAN_LIMIT_REACHED",
          planId: plan.id,
          currentActiveJobs: activeJobsCount,
          maxActiveJobs,
        },
        { status: 402 }
      );
    }

    /* -------------------------------------------------
       Crear vacante + syncJobSkills en transacción
    --------------------------------------------------*/
    const job = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          title,
          description,
          descriptionHtml: descriptionHtml || undefined,

          location: remote ? "Remoto" : city || "—",
          locationType,
          locationLat: safeLat ?? undefined,
          locationLng: safeLng ?? undefined,
          country: country ?? undefined,
          admin1: admin1 ?? undefined,
          city: city ?? undefined,
          cityNorm: cityNorm ?? undefined,
          admin1Norm: admin1Norm ?? undefined,

          remote,
          employmentType,
          schedule,
          benefitsJson: benefitsJson ?? undefined,
          showBenefits,

          educationJson: educationJson ?? undefined,
          minDegree,

          skillsJson: skillsJson ?? undefined,
          certsJson: certsJson ?? undefined,
          skills: skillsList,

          salaryMin: salaryMin ?? undefined,
          salaryMax: salaryMax ?? undefined,
          currency,
          showSalary,

          companyConfidential,
          status: JobStatus.OPEN,

          companyId,
          recruiterId: userId,
        },
        select: { id: true },
      });

      await syncJobSkills(tx, createdJob.id, skillsJson);

      return createdJob;
    });

    /* -------------------------------------------------
       Guardar plantilla (JobTemplate)
    --------------------------------------------------*/
    try {
      const payloadForTemplate = {
        title,
        locationType,
        city,
        country,
        admin1,
        cityNorm,
        admin1Norm,
        locationLat: safeLat,
        locationLng: safeLng,
        currency,
        salaryMin,
        salaryMax,
        showSalary,
        employmentType,
        schedule,
        benefitsJson: benefitsJson ?? {},
        description,
        descriptionHtml: descriptionHtml || null,
        education: educationJson ?? [],
        minDegree,
        skills: Array.isArray(skillsJson) ? skillsJson : [],
        certs: Array.isArray(certsJson) ? certsJson : [],
        _v: 1,
      };

      const existingTpl = await prisma.jobTemplate.findFirst({
        where: { companyId, title },
        select: { id: true },
      });

      if (existingTpl) {
        await prisma.jobTemplate.update({
          where: { id: existingTpl.id },
          data: {
            title,
            payload: payloadForTemplate,
            lastUsedAt: new Date(),
          },
        });
      } else {
        await prisma.jobTemplate.create({
          data: {
            companyId,
            title,
            payload: payloadForTemplate,
            creatorId: userId,
            lastUsedAt: new Date(),
          },
        });
      }
    } catch (tplErr) {
      console.warn("[POST /api/jobs] JobTemplate save skipped:", tplErr);
    }

    return NextResponse.json({ ok: true, id: job.id });
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return NextResponse.json(
      { error: "Error al crear la vacante" },
      { status: 500 }
    );
  }
}