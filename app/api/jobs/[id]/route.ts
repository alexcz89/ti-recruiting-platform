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

// -------------------------------
// Helpers
// -------------------------------
const getStr = (fd: FormData, k: string) => (fd.get(k)?.toString().trim() || "");

const getNum = (fd: FormData, k: string) => {
  const raw = getStr(fd, k);
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
};

const getBool = (fd: FormData, k: string) =>
  ["true", "1", "on", "yes", "si", "sí"].includes(getStr(fd, k).toLowerCase());

const getJson = <T>(fd: FormData, k: string): T | null => {
  try {
    const raw = getStr(fd, k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUS_VALUES.includes(value as (typeof JOB_STATUS_VALUES)[number]);
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

  const normalized = raw.toUpperCase();

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
    MASTER: "MASTER",
    DOCTORATE: "DOCTORATE",
    PHD: "DOCTORATE",
    OTHER: "OTHER",

    "NINGUNO": "NONE",
    "PRIMARIA": "PRIMARY",
    "SECUNDARIA": "SECONDARY",
    "BACHILLERATO": "HIGH_SCHOOL",
    "TÉCNICO": "TECHNICAL",
    "TECNICO": "TECHNICAL",
    "LICENCIATURA / INGENIERÍA": "BACHELOR",
    "LICENCIATURA / INGENIERIA": "BACHELOR",
    "LICENCIATURA": "BACHELOR",
    "INGENIERÍA": "BACHELOR",
    "INGENIERIA": "BACHELOR",
    "MAESTRÍA": "MASTER",
    "MAESTRIA": "MASTER",
    "DOCTORADO": "DOCTORATE",
    "OTRO": "OTHER",
  };

  if (isEducationLevel(normalized)) {
    return normalized;
  }

  return aliases[normalized];
}

// -------------------------------
// GET
// -------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getSessionOrThrow();
    const companyId = await getSessionCompanyId();

    if (!companyId) {
      return NextResponse.json(
        { error: "Sin empresa asociada" },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: "Vacante no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return NextResponse.json(
      { error: "Error al obtener la vacante" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: "Sin empresa asociada" },
        { status: 401 }
      );
    }

    // @ts-ignore
    const role = session.user?.role;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json(
        { error: "Vacante no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");

    // PATCH ligero: solo status
    if (isJsonRequest) {
      const body = await req.json().catch(() => null);
      const status = body?.status;

      if (!status || typeof status !== "string" || !isJobStatus(status)) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 }
        );
      }

      await prisma.job.update({
        where: { id: params.id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true });
    }

    const fd = await req.formData();

    const title = getStr(fd, "title");
    const description = getStr(fd, "description");

    if (!title || !description) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const rawLocationType = getStr(fd, "locationType") || "ONSITE";
    if (!isLocationType(rawLocationType)) {
      return NextResponse.json(
        { error: "locationType inválido" },
        { status: 400 }
      );
    }
    const locationType: LocationType = rawLocationType;

    const rawEmploymentType = getStr(fd, "employmentType") || "FULL_TIME";
    if (!isEmploymentType(rawEmploymentType)) {
      return NextResponse.json(
        { error: "employmentType inválido" },
        { status: 400 }
      );
    }
    const employmentType: EmploymentType = rawEmploymentType;

    const rawMinDegree = getStr(fd, "minDegree");
    const normalizedMinDegree = normalizeEducationLevel(rawMinDegree);

    if (normalizedMinDegree === undefined) {
      return NextResponse.json(
        { error: "minDegree inválido" },
        { status: 400 }
      );
    }

    const minDegree = normalizedMinDegree;

    const city = getStr(fd, "city") || null;
    const country = getStr(fd, "country") || null;
    const admin1 = getStr(fd, "admin1") || null;
    const cityNorm = getStr(fd, "cityNorm") || null;
    const admin1Norm = getStr(fd, "admin1Norm") || null;

    const lat = getNum(fd, "locationLat");
    const lng = getNum(fd, "locationLng");
    const remote = locationType === "REMOTE";

    const salaryMin = getNum(fd, "salaryMin");
    const salaryMax = getNum(fd, "salaryMax");
    const showSalary = getBool(fd, "showSalary");
    const currency = getStr(fd, "currency") || "MXN";

    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return NextResponse.json(
        { error: "El sueldo mínimo no puede ser mayor que el máximo" },
        { status: 400 }
      );
    }

    const schedule = getStr(fd, "schedule") || null;
    const showBenefits = getBool(fd, "showBenefits");
    const benefitsJson = getJson(fd, "benefitsJson");
    const educationJson = getJson(fd, "educationJson");
    const skillsJson = getJson<JobSkillInput[]>(fd, "skillsJson");
    const certsJson = getJson(fd, "certsJson");

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
            creatorId: session.user?.id as string,
            lastUsedAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.warn("[PATCH /api/jobs/[id]] JobTemplate update skipped:", err);
    }

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]]", err);
    return NextResponse.json(
      { error: "Error al actualizar la vacante" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: "Sin empresa asociada" },
        { status: 401 }
      );
    }

    // @ts-ignore
    const role = session.user?.role;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.job.findFirst({
      where: { id: params.id, companyId },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Vacante no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    await prisma.job.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/[id]]", err);
    return NextResponse.json(
      { error: "Error al eliminar la vacante" },
      { status: 500 }
    );
  }
}