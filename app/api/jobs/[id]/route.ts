// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { syncJobSkills } from "@/lib/server/syncJobSkills";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/server/session";
import {
  EmploymentType,
  EducationLevel,
  JobStatus,
  LocationType,
  type Prisma,
} from "@prisma/client";

type JobSkillInput = {
  name?: string;
  required?: boolean;
  weight?: number;
};

const JOB_STATUS_VALUES = ["OPEN", "PAUSED", "CLOSED"] as const;
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

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

// -------------------------------
// Helpers
// -------------------------------
function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

const getStr = (fd: FormData, k: string) =>
  fd.get(k)?.toString().trim() || "";

const getNum = (fd: FormData, k: string) => {
  const raw = getStr(fd, k);
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
};

const getBool = (fd: FormData, k: string) =>
  ["true", "1", "on", "yes", "si", "sí"].includes(
    getStr(fd, k).toLowerCase()
  );

function getJson<T>(
  fd: FormData,
  k: string
): { ok: true; value: T | null } | { ok: false } {
  const raw = getStr(fd, k);
  if (!raw) return { ok: true, value: null };

  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false };
  }
}

function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUS_VALUES.includes(
    value as (typeof JOB_STATUS_VALUES)[number]
  );
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
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases: Record<string, EducationLevel> = {
    NONE: "NONE",
    PRIMARY: "PRIMARY",
    SECONDARY: "SECONDARY",
    HIGH_SCHOOL: "HIGH_SCHOOL",
    HIGHSCHOOL: "HIGH_SCHOOL",
    TECHNICAL: "TECHNICAL",
    TECH: "TECHNICAL",
    ASSOCIATE: "TECHNICAL",
    BACHELOR: "BACHELOR",
    BACHELORS: "BACHELOR",
    MASTER: "MASTER",
    MASTERS: "MASTER",
    DOCTORATE: "DOCTORATE",
    DOCTORATES: "DOCTORATE",
    PHD: "DOCTORATE",
    OTHER: "OTHER",

    NINGUNO: "NONE",
    PRIMARIA: "PRIMARY",
    SECUNDARIA: "SECONDARY",
    BACHILLERATO: "HIGH_SCHOOL",
    PREPARATORIA: "HIGH_SCHOOL",
    PREPA: "HIGH_SCHOOL",
    TECNICO: "TECHNICAL",
    TECNICA: "TECHNICAL",
    "LICENCIATURA / INGENIERIA": "BACHELOR",
    "LICENCIATURA / INGENIERA": "BACHELOR",
    LICENCIATURA: "BACHELOR",
    INGENIERIA: "BACHELOR",
    INGENIERO: "BACHELOR",
    MAESTRIA: "MASTER",
    DOCTORADO: "DOCTORATE",
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

function sanitizeCoordinate(
  value: number | null,
  type: "lat" | "lng"
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  if (type === "lat") {
    return value >= -90 && value <= 90 ? value : null;
  }

  return value >= -180 && value <= 180 ? value : null;
}

// -------------------------------
// GET /api/jobs/[id]
// -------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const companyId = await getSessionCompanyId();

    if (!companyId) {
      return jsonNoStore({ error: "Sin empresa asociada" }, 401);
    }

    const role = session.user?.role;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const job = await prisma.job.findFirst({
      where: {
        id: params.id,
        companyId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        descriptionHtml: true,
        location: true,
        locationType: true,
        locationLat: true,
        locationLng: true,
        country: true,
        admin1: true,
        city: true,
        cityNorm: true,
        admin1Norm: true,
        remote: true,
        employmentType: true,
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
        status: true,
        createdAt: true,
        updatedAt: true,
        companyConfidential: true,
        assessments: {
          select: {
            templateId: true,
            isRequired: true,
            minScore: true,
            triggerAt: true,
            template: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                difficulty: true,
                totalQuestions: true,
                timeLimit: true,
                passingScore: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!job) {
      return jsonNoStore({ error: "Vacante no encontrada" }, 404);
    }

    return jsonNoStore({
      job: {
        ...job,
        assessmentTemplateIds: job.assessments.map((a) => a.templateId),
      },
    });
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return jsonNoStore({ error: "Internal Server Error" }, 500);
  }
}

// -------------------------------
// PUT /api/jobs/[id]
// -------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const companyId = await getSessionCompanyId();

    if (!companyId) {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    const role = session.user?.role;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return jsonNoStore({ error: "Forbidden" }, 403);
    }

    const userId = session.user?.id;
    if (!userId) {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    const jobId = params.id;
    const formData = await req.formData();

    const existingJob = await prisma.job.findFirst({
      where: {
        id: jobId,
        companyId,
      },
      select: { id: true },
    });

    if (!existingJob) {
      return jsonNoStore({ error: "Vacante no encontrada" }, 404);
    }

    const title = getStr(formData, "title");
    const description = getStr(formData, "description");
    const descriptionHtml = getStr(formData, "descriptionHtml");

    if (!title || !description) {
      return jsonNoStore({ error: "Faltan campos obligatorios" }, 400);
    }

    const rawLocationType = getStr(formData, "locationType") || "ONSITE";
    if (!isLocationType(rawLocationType)) {
      return jsonNoStore({ error: "locationType inválido" }, 400);
    }
    const locationType: LocationType = rawLocationType;

    const rawEmploymentType =
      getStr(formData, "employmentType") || "FULL_TIME";
    if (!isEmploymentType(rawEmploymentType)) {
      return jsonNoStore({ error: "employmentType inválido" }, 400);
    }
    const employmentType: EmploymentType = rawEmploymentType;

    const rawMinDegree = getStr(formData, "minDegree");
    const normalizedMinDegree = normalizeEducationLevel(rawMinDegree);
    if (normalizedMinDegree === undefined) {
      return jsonNoStore({ error: "minDegree inválido" }, 400);
    }
    const minDegree = normalizedMinDegree;

    const rawStatus = getStr(formData, "status");
    if (rawStatus && !isJobStatus(rawStatus)) {
      return jsonNoStore({ error: "status inválido" }, 400);
    }
    const status: JobStatus | undefined = rawStatus
      ? (rawStatus as JobStatus)
      : undefined;

    const city = getStr(formData, "city");
    const country = getStr(formData, "country") || null;
    const admin1 = getStr(formData, "admin1") || null;
    const cityNorm = getStr(formData, "cityNorm") || null;
    const admin1Norm = getStr(formData, "admin1Norm") || null;

    const locationLat = getNum(formData, "locationLat");
    const locationLng = getNum(formData, "locationLng");
    const safeLat = sanitizeCoordinate(locationLat, "lat");
    const safeLng = sanitizeCoordinate(locationLng, "lng");

    const remote = locationType === "REMOTE";
    const currency = getStr(formData, "currency") || "MXN";
    const salaryMin = getNum(formData, "salaryMin");
    const salaryMax = getNum(formData, "salaryMax");
    const showSalary = getBool(formData, "showSalary");

    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return jsonNoStore(
        {
          error: "El sueldo mínimo no puede ser mayor que el sueldo máximo.",
        },
        400
      );
    }

    const schedule = getStr(formData, "schedule") || null;
    const showBenefits = getBool(formData, "showBenefits");

    const benefitsJsonParsed = getJson<Prisma.JsonValue>(
      formData,
      "benefitsJson"
    );
    if (!benefitsJsonParsed.ok) {
      return jsonNoStore({ error: "benefitsJson inválido" }, 400);
    }
    const benefitsJson = benefitsJsonParsed.value;

    const educationJsonParsed = getJson<Prisma.JsonValue>(
      formData,
      "educationJson"
    );
    if (!educationJsonParsed.ok) {
      return jsonNoStore({ error: "educationJson inválido" }, 400);
    }
    const educationJson = educationJsonParsed.value;

    const skillsJsonParsed = getJson<JobSkillInput[]>(
      formData,
      "skillsJson"
    );
    if (!skillsJsonParsed.ok) {
      return jsonNoStore({ error: "skillsJson inválido" }, 400);
    }
    const skillsJson = skillsJsonParsed.value;

    const certsJsonParsed = getJson<Prisma.JsonValue>(formData, "certsJson");
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

    const companyMode = getStr(formData, "companyMode");
    const companyConfidential = companyMode === "confidential";

    const assessmentTemplateIdsParsed = getJson<string[]>(
      formData,
      "assessmentTemplateIds"
    );
    if (!assessmentTemplateIdsParsed.ok) {
      return jsonNoStore({ error: "assessmentTemplateIds inválido" }, 400);
    }

    let assessmentTemplateIds: string[] = Array.isArray(
      assessmentTemplateIdsParsed.value
    )
      ? assessmentTemplateIdsParsed.value
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    // Compatibilidad temporal
    const rawAssessmentTemplateId = getStr(formData, "assessmentTemplateId");
    if (assessmentTemplateIds.length === 0 && rawAssessmentTemplateId) {
      assessmentTemplateIds = [rawAssessmentTemplateId];
    }

    assessmentTemplateIds = Array.from(new Set(assessmentTemplateIds));

    if (assessmentTemplateIds.length > 0) {
      const existingTemplates = await prisma.assessmentTemplate.findMany({
        where: { id: { in: assessmentTemplateIds } },
        select: { id: true },
      });

      const existingIds = new Set(existingTemplates.map((t) => t.id));
      const missingIds = assessmentTemplateIds.filter((id) => !existingIds.has(id));

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

    const job = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { id: jobId },
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
          ...(status ? { status } : {}),
          recruiterId: userId,
        },
        select: { id: true },
      });

      await syncJobSkills(tx, updatedJob.id, skillsJson);

      // Reemplazo completo de assessments en edición
      await tx.jobAssessment.deleteMany({
        where: { jobId: updatedJob.id },
      });

      if (assessmentTemplateIds.length > 0) {
        await tx.jobAssessment.createMany({
          data: assessmentTemplateIds.map((templateId) => ({
            jobId: updatedJob.id,
            templateId,
            isRequired: true,
            minScore: null,
            triggerAt: "AFTER_APPLY",
          })),
          skipDuplicates: true,
        });
      }

      return updatedJob;
    });

    return jsonNoStore({ ok: true, id: job.id });
  } catch (err) {
    console.error("[PUT /api/jobs/[id]]", err);
    return jsonNoStore({ error: "Error al actualizar la vacante" }, 500);
  }
}