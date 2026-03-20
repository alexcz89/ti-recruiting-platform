// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { syncJobSkills } from "@/lib/server/syncJobSkills";
import { getSessionOrThrow, getSessionCompanyId } from "@/lib/server/session";
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

  if (isEducationLevel(normalized)) {
    return normalized;
  }

  if (
    normalized.includes("LICENCIATURA") ||
    normalized.includes("INGENIERIA")
  )
    return "BACHELOR";
  if (normalized.includes("MAESTRIA")) return "MASTER";
  if (normalized.includes("DOCTORADO")) return "DOCTORATE";
  if (
    normalized.includes("BACHILLERATO") ||
    normalized.includes("PREPARATORIA") ||
    normalized.includes("PREPA")
  )
    return "HIGH_SCHOOL";
  if (normalized.includes("TECNICO") || normalized.includes("TECNICA"))
    return "TECHNICAL";
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
// GET
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
      },
    });

    if (!job) {
      return jsonNoStore({ error: "Vacante no encontrada" }, 404);
    }

    return jsonNoStore(job);
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return jsonNoStore({ error: "Error al obtener la vacante" }, 500);
  }
}

// -------------------------------
// PATCH
// -------------------------------
export async function PATCH(
  req: NextRequest,
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

    const userId = session.user?.id;
    if (!userId) {
      return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    const existingJob = await prisma.job.findFirst({
      where: {
        id: params.id,
        companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingJob) {
      return jsonNoStore(
        { error: "Vacante no encontrada o sin permisos" },
        404
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");

    // PATCH ligero: solo status
    if (isJsonRequest) {
      const body = await req.json().catch(() => null);
      const status = body?.status;

      if (!status || typeof status !== "string" || !isJobStatus(status)) {
        return jsonNoStore({ error: "Estado inválido" }, 400);
      }

      await prisma.job.update({
        where: { id: params.id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      return jsonNoStore({ ok: true });
    }

    const fd = await req.formData();

    const title = getStr(fd, "title");
    const description = getStr(fd, "description");
    const descriptionHtml = getStr(fd, "descriptionHtml");

    if (!title || !description) {
      return jsonNoStore({ error: "Faltan campos obligatorios" }, 400);
    }

    const rawLocationType = getStr(fd, "locationType") || "ONSITE";
    if (!isLocationType(rawLocationType)) {
      return jsonNoStore({ error: "locationType inválido" }, 400);
    }
    const locationType: LocationType = rawLocationType;

    const rawEmploymentType = getStr(fd, "employmentType") || "FULL_TIME";
    if (!isEmploymentType(rawEmploymentType)) {
      return jsonNoStore({ error: "employmentType inválido" }, 400);
    }
    const employmentType: EmploymentType = rawEmploymentType;

    const rawMinDegree = getStr(fd, "minDegree");
    const normalizedMinDegree = normalizeEducationLevel(rawMinDegree);

    if (normalizedMinDegree === undefined) {
      return jsonNoStore({ error: "minDegree inválido" }, 400);
    }

    const minDegree = normalizedMinDegree;

    const city = getStr(fd, "city") || null;
    const country = getStr(fd, "country") || null;
    const admin1 = getStr(fd, "admin1") || null;
    const cityNorm = getStr(fd, "cityNorm") || null;
    const admin1Norm = getStr(fd, "admin1Norm") || null;

    const lat = sanitizeCoordinate(getNum(fd, "locationLat"), "lat");
    const lng = sanitizeCoordinate(getNum(fd, "locationLng"), "lng");
    const remote = locationType === "REMOTE";

    const salaryMin = getNum(fd, "salaryMin");
    const salaryMax = getNum(fd, "salaryMax");
    const showSalary = getBool(fd, "showSalary");
    const currency = getStr(fd, "currency") || "MXN";

    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return jsonNoStore(
        { error: "El sueldo mínimo no puede ser mayor que el máximo" },
        400
      );
    }

    const schedule = getStr(fd, "schedule") || null;
    const showBenefits = getBool(fd, "showBenefits");

    const benefitsJsonParsed = getJson<Prisma.JsonValue>(fd, "benefitsJson");
    if (!benefitsJsonParsed.ok) {
      return jsonNoStore({ error: "benefitsJson inválido" }, 400);
    }
    const benefitsJson = benefitsJsonParsed.value;

    const educationJsonParsed = getJson<Prisma.JsonValue>(fd, "educationJson");
    if (!educationJsonParsed.ok) {
      return jsonNoStore({ error: "educationJson inválido" }, 400);
    }
    const educationJson = educationJsonParsed.value;

    const skillsJsonParsed = getJson<JobSkillInput[]>(fd, "skillsJson");
    if (!skillsJsonParsed.ok) {
      return jsonNoStore({ error: "skillsJson inválido" }, 400);
    }
    const skillsJson = skillsJsonParsed.value;

    const certsJsonParsed = getJson<Prisma.JsonValue>(fd, "certsJson");
    if (!certsJsonParsed.ok) {
      return jsonNoStore({ error: "certsJson inválido" }, 400);
    }
    const certsJson = certsJsonParsed.value;

    const skillsList =
      Array.isArray(skillsJson)
        ? skillsJson
            .map((s) =>
              s?.name ? `${s.required ? "Req" : "Dese"}: ${s.name}` : ""
            )
            .filter(Boolean)
        : [];

    const companyConfidential = getStr(fd, "companyMode") === "confidential";

    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { id: params.id },
        data: {
          title,
          description,
          descriptionHtml: descriptionHtml || undefined,

          location: remote ? "Remoto" : city || "—",
          locationType,
          locationLat: lat ?? undefined,
          locationLng: lng ?? undefined,
          country: country ?? undefined,
          admin1: admin1 ?? undefined,
          city: city ?? undefined,
          cityNorm: cityNorm ?? undefined,
          admin1Norm: admin1Norm ?? undefined,

          remote,
          employmentType,

          salaryMin: salaryMin ?? undefined,
          salaryMax: salaryMax ?? undefined,
          currency,
          showSalary,

          schedule,
          showBenefits,
          benefitsJson: benefitsJson ?? undefined,

          educationJson: educationJson ?? undefined,
          minDegree,

          skillsJson: skillsJson ?? undefined,
          certsJson: certsJson ?? undefined,
          skills: skillsList,

          companyConfidential,
          status: existingJob.status,
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      await syncJobSkills(tx, params.id, skillsJson);

      return updatedJob;
    });

    try {
      const payload = {
        title,
        locationType,
        city,
        country,
        admin1,
        cityNorm,
        admin1Norm,
        locationLat: lat,
        locationLng: lng,
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
        skills: skillsJson ?? [],
        certs: certsJson ?? [],
        _v: 1,
      };

      const existingTpl = await prisma.jobTemplate.findFirst({
        where: {
          companyId,
          title,
        },
        select: { id: true },
      });

      if (existingTpl) {
        await prisma.jobTemplate.update({
          where: { id: existingTpl.id },
          data: { payload, lastUsedAt: new Date() },
        });
      } else {
        await prisma.jobTemplate.create({
          data: {
            companyId,
            title,
            payload,
            creatorId: userId,
            lastUsedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.warn("[PATCH /api/jobs/[id]] JobTemplate update skipped:", err);
    }

    return jsonNoStore({ ok: true, id: updated.id });
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]]", err);
    return jsonNoStore({ error: "Error al actualizar la vacante" }, 500);
  }
}

// -------------------------------
// DELETE
// -------------------------------
export async function DELETE(
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

    const exists = await prisma.job.findFirst({
      where: { id: params.id, companyId },
      select: { id: true },
    });

    if (!exists) {
      return jsonNoStore(
        { error: "Vacante no encontrada o sin permisos" },
        404
      );
    }

    await prisma.job.delete({ where: { id: params.id } });

    return jsonNoStore({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/[id]]", err);
    return jsonNoStore({ error: "Error al eliminar la vacante" }, 500);
  }
}