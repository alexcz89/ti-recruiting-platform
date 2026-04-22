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

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function jsonPublic(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PUBLIC_CACHE_HEADERS });
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

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

function getFormJSON<T>(
  fd: FormData,
  key: string
): { ok: true; value: T | null } | { ok: false } {
  const raw = getFormString(fd, key);
  if (!raw) return { ok: true, value: null };

  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false };
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

function normalizeEducationLevel(
  value: string
): EducationLevel | null | undefined {
  const raw = value.trim();
  if (!raw) return null;

  const normalized = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();

  const aliases: Record<string, EducationLevel> = {
    NONE: "NONE",
    NINGUNO: "NONE",
    NINGUNA: "NONE",
    SIN_ESTUDIOS: "NONE",
    PRIMARY: "PRIMARY",
    PRIMARIA: "PRIMARY",
    SECONDARY: "SECONDARY",
    SECUNDARIA: "SECONDARY",
    HIGH_SCHOOL: "HIGH_SCHOOL",
    HIGHSCHOOL: "HIGH_SCHOOL",
    BACHILLERATO: "HIGH_SCHOOL",
    PREPARATORIA: "HIGH_SCHOOL",
    PREPA: "HIGH_SCHOOL",
    TECHNICAL: "TECHNICAL",
    TECNICO: "TECHNICAL",
    TECNICA: "TECHNICAL",
    BACHELOR: "BACHELOR",
    LICENCIATURA: "BACHELOR",
    INGENIERIA: "BACHELOR",
    UNIVERSIDAD: "BACHELOR",
    MASTER: "MASTER",
    MAESTRIA: "MASTER",
    DOCTORATE: "DOCTORATE",
    DOCTORADO: "DOCTORATE",
    OTHER: "OTHER",
    OTRO: "OTHER",
    "0": "NONE",
    "1": "PRIMARY",
    "2": "SECONDARY",
    "3": "HIGH_SCHOOL",
    "4": "TECHNICAL",
    "5": "BACHELOR",
    "6": "MASTER",
    "7": "DOCTORATE",
  };

  if (aliases[normalized]) return aliases[normalized];
  if (isEducationLevel(normalized)) return normalized;

  if (
    normalized.includes("LICENCIATURA") ||
    normalized.includes("INGENIERIA")
  ) {
    return "BACHELOR";
  }
  if (normalized.includes("MAESTRIA")) return "MASTER";
  if (normalized.includes("DOCTORADO")) return "DOCTORATE";
  if (
    normalized.includes("BACHILLERATO") ||
    normalized.includes("PREPARATORIA") ||
    normalized.includes("PREPA")
  ) {
    return "HIGH_SCHOOL";
  }
  if (normalized.includes("TECNICO") || normalized.includes("TECNICA")) {
    return "TECHNICAL";
  }
  if (normalized.includes("SECUNDARIA")) return "SECONDARY";
  if (normalized.includes("PRIMARIA")) return "PRIMARY";

  return undefined;
}

function parsePositiveLimit(raw: string | null, fallback = 10, max = 50) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), max);
}

function normalizeSort(raw: string | null): "recent" | "updated" {
  return raw === "updated" ? "updated" : "recent";
}

function sanitizeCoordinate(
  value: number | null,
  type: "lat" | "lng"
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (type === "lat") return value >= -90 && value <= 90 ? value : null;
  return value >= -180 && value <= 180 ? value : null;
}

/* -------------------------------------------------
   GET /api/jobs
--------------------------------------------------*/
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

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

      if (!job) return jsonPublic({ job: null });

      const companyObj = job.companyConfidential
        ? null
        : job.company
        ? {
            name: job.company.name ?? null,
            logoUrl: job.company.logoUrl ?? null,
          }
        : null;

      return jsonPublic({
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
          logoUrl: job.companyConfidential ? null : companyObj?.logoUrl ?? null,
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

    const limit = parsePositiveLimit(searchParams.get("limit"), 10, 50);
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
    const employmentTypeParam = (
      searchParams.get("employmentType") || ""
    ).trim();
    const employmentType = isEmploymentType(employmentTypeParam)
      ? employmentTypeParam
      : undefined;
    const sort = normalizeSort(searchParams.get("sort"));

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
        ],
      });
    }

    if (remote !== undefined) andFilters.push({ remote });
    if (employmentType) andFilters.push({ employmentType });

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
        logoUrl: j.companyConfidential ? null : companyObj?.logoUrl ?? null,
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

    return jsonPublic({ items, nextCursor });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}

/* -------------------------------------------------
   POST /api/jobs — Crear vacante
--------------------------------------------------*/
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();

    const role = session.user?.role;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const companyId = await getSessionCompanyId();
    if (!companyId) return jsonNoStore({ error: "Unauthorized" }, 401);

    const userId = session.user?.id;
    if (!userId) return jsonNoStore({ error: "Unauthorized" }, 401);

    const formData = await req.formData();

    console.log("========== DEBUG POST /api/jobs ==========");
    const debugEntries = Array.from(formData.entries()).map(([key, value]) => [
      key,
      typeof value === "string" ? value : `[File:${value.name}]`,
    ]);
    console.log("FormData entries:", Object.fromEntries(debugEntries));
    console.log(
      "assessmentTemplateId raw:",
      getFormString(formData, "assessmentTemplateId")
    );
    console.log(
      "assessmentTemplateIds raw (fd.get):",
      getFormString(formData, "assessmentTemplateIds")
    );
    console.log(
      "assessmentTemplateIds raw (fd.getAll):",
      formData.getAll("assessmentTemplateIds")
    );

    const incomingJobId = getFormString(formData, "jobId");
    if (incomingJobId) {
      return jsonNoStore(
        {
          error: "Esta operación es de edición. Usa el endpoint de actualización.",
        },
        409
      );
    }

    const title = getFormString(formData, "title");
    const description = getFormString(formData, "description");
    const descriptionHtml = getFormString(formData, "descriptionHtml");

    if (!title || !description) {
      return jsonNoStore({ error: "Faltan campos obligatorios" }, 400);
    }

    const rawLocationType = getFormString(formData, "locationType") || "ONSITE";
    if (!isLocationType(rawLocationType)) {
      return jsonNoStore({ error: "locationType inválido" }, 400);
    }
    const locationType: LocationType = rawLocationType;

    const rawEmploymentType =
      getFormString(formData, "employmentType") || "FULL_TIME";
    if (!isEmploymentType(rawEmploymentType)) {
      return jsonNoStore({ error: "employmentType inválido" }, 400);
    }
    const employmentType: EmploymentType = rawEmploymentType;

    const rawMinDegree = getFormString(formData, "minDegree");
    const normalizedMinDegree = normalizeEducationLevel(rawMinDegree);
    if (normalizedMinDegree === undefined) {
      return jsonNoStore({ error: "minDegree inválido" }, 400);
    }
    const minDegree = normalizedMinDegree;

    const city = getFormString(formData, "city");
    const country = getFormString(formData, "country") || null;
    const admin1 = getFormString(formData, "admin1") || null;
    const cityNorm = getFormString(formData, "cityNorm") || null;
    const admin1Norm = getFormString(formData, "admin1Norm") || null;

    const locationLat = getFormNumber(formData, "locationLat");
    const locationLng = getFormNumber(formData, "locationLng");
    const safeLat = sanitizeCoordinate(locationLat, "lat");
    const safeLng = sanitizeCoordinate(locationLng, "lng");

    const remote = locationType === "REMOTE";
    const currency = getFormString(formData, "currency") || "MXN";
    const salaryMin = getFormNumber(formData, "salaryMin");
    const salaryMax = getFormNumber(formData, "salaryMax");
    const showSalary = getFormBool(formData, "showSalary");

    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return jsonNoStore(
        {
          error: "El sueldo mínimo no puede ser mayor que el sueldo máximo.",
        },
        400
      );
    }

    const schedule = getFormString(formData, "schedule") || null;
    const showBenefits = getFormBool(formData, "showBenefits");

    const benefitsJsonParsed = getFormJSON<Prisma.JsonValue>(
      formData,
      "benefitsJson"
    );
    if (!benefitsJsonParsed.ok) {
      return jsonNoStore({ error: "benefitsJson inválido" }, 400);
    }
    const benefitsJson = benefitsJsonParsed.value;

    const educationJsonParsed = getFormJSON<Prisma.JsonValue>(
      formData,
      "educationJson"
    );
    if (!educationJsonParsed.ok) {
      return jsonNoStore({ error: "educationJson inválido" }, 400);
    }
    const educationJson = educationJsonParsed.value;

    const skillsJsonParsed = getFormJSON<JobSkillInput[]>(
      formData,
      "skillsJson"
    );
    if (!skillsJsonParsed.ok) {
      return jsonNoStore({ error: "skillsJson inválido" }, 400);
    }
    const skillsJson = skillsJsonParsed.value;

    const certsJsonParsed = getFormJSON<Prisma.JsonValue>(formData, "certsJson");
    if (!certsJsonParsed.ok) {
      return jsonNoStore({ error: "certsJson inválido" }, 400);
    }
    const certsJson = certsJsonParsed.value;

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

    // ─── Parseo robusto de assessmentTemplateIds ──────────────────────────────
    // El wizard puede enviar los IDs de dos formas distintas:
    //   A) fd.set("assessmentTemplateIds", JSON.stringify([id1, id2]))
    //      → formData.get() devuelve un string JSON → parseamos con JSON.parse
    //   B) assessmentTemplateIds.forEach(id => fd.append("assessmentTemplateIds", id))
    //      → formData.getAll() devuelve string[] → los usamos directamente
    // Soportamos ambos formatos para máxima compatibilidad.
    let assessmentTemplateIds: string[] = [];

    const fromGetAll = formData.getAll("assessmentTemplateIds") as string[];

    if (fromGetAll.length === 1 && fromGetAll[0].trim().startsWith("[")) {
      // Formato A: un único valor que es un JSON array string
      try {
        const parsed = JSON.parse(fromGetAll[0]);
        if (Array.isArray(parsed)) {
          assessmentTemplateIds = parsed
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean);
        }
      } catch {
        console.error("assessmentTemplateIds JSON inválido:", fromGetAll[0]);
        // No retornamos error — simplemente quedará vacío y se continuará sin assessments
      }
    } else if (fromGetAll.length > 0) {
      // Formato B: múltiples entradas individuales (fd.append por cada id)
      assessmentTemplateIds = fromGetAll
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim());
    }

    // Fallback: campo singular assessmentTemplateId (compatibilidad con backend viejo)
    const rawAssessmentTemplateId = getFormString(
      formData,
      "assessmentTemplateId"
    );
    if (assessmentTemplateIds.length === 0 && rawAssessmentTemplateId) {
      assessmentTemplateIds = [rawAssessmentTemplateId];
    }

    assessmentTemplateIds = Array.from(new Set(assessmentTemplateIds));

    console.log(
      "assessmentTemplateIds parsed/final:",
      assessmentTemplateIds,
      "count:",
      assessmentTemplateIds.length
    );

    if (assessmentTemplateIds.length > 0) {
      const existingTemplates = await prisma.assessmentTemplate.findMany({
        where: { id: { in: assessmentTemplateIds } },
        select: { id: true, title: true },
      });

      const existingIds = new Set(existingTemplates.map((t) => t.id));
      const missingIds = assessmentTemplateIds.filter((id) => !existingIds.has(id));

      console.log("existing template ids:", existingTemplates);
      console.log("missing template ids:", missingIds);

      if (missingIds.length > 0) {
        return jsonNoStore(
          {
            error: "Uno o más assessment templates no existen",
            missingTemplateIds: missingIds,
          },
          400
        );
      }
    }

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
      console.log("deduped existing job:", existing.id);
      return jsonNoStore({ ok: true, id: existing.id, deduped: true });
    }

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
      return jsonNoStore(
        {
          error: `Has alcanzado el límite de ${maxActiveJobs} vacantes activas para tu plan (${plan.name}).`,
          code: "PLAN_LIMIT_REACHED",
          planId: plan.id,
          currentActiveJobs: activeJobsCount,
          maxActiveJobs,
        },
        402
      );
    }

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
        select: { id: true, title: true },
      });

      console.log("createdJob:", createdJob);

      await syncJobSkills(tx, createdJob.id, skillsJson);

      if (assessmentTemplateIds.length > 0) {
        console.log(
          "about to createMany JobAssessment for job:",
          createdJob.id,
          "templates:",
          assessmentTemplateIds
        );

        await tx.jobAssessment.createMany({
          data: assessmentTemplateIds.map((templateId) => ({
            jobId: createdJob.id,
            templateId,
            isRequired: true,
            minScore: null,
            triggerAt: "AFTER_APPLY",
          })),
          skipDuplicates: true,
        });
      } else {
        console.log("no assessmentTemplateIds to persist");
      }

      const persistedAssessments = await tx.jobAssessment.findMany({
        where: { jobId: createdJob.id },
        select: {
          id: true,
          jobId: true,
          templateId: true,
          isRequired: true,
          triggerAt: true,
        },
      });

      console.log("persisted jobAssessments:", persistedAssessments);

      return createdJob;
    });

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
        assessmentTemplateIds,
        _v: 2,
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

    console.log("========== END DEBUG POST /api/jobs ==========");
    return jsonNoStore({ ok: true, id: job.id });
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return jsonNoStore({ error: "Error al crear la vacante" }, 500);
  }
}