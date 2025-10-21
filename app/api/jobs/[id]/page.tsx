// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionOrThrow, getSessionCompanyId } from "@/lib/session";
import {
  EmploymentType,
  JobStatus,
  EducationLevel,
  LocationType,
} from "@prisma/client";

// helpers locales (mismos del POST)
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
  return v === "true" || v === "1" || v === "on" || v === "yes" || v === "sí" || v === "si";
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

/**
 * GET /api/jobs/[id]
 * Devuelve una vacante específica (solo si pertenece a la empresa del recruiter)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await getSessionOrThrow();
    const companyId = await getSessionCompanyId();

    const job = await prisma.job.findFirst({
      where: { id: params.id, companyId },
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
      return NextResponse.json({ error: "Vacante no encontrada" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return NextResponse.json({ error: "Error al obtener la vacante" }, { status: 500 });
  }
}

/**
 * PATCH /api/jobs/[id]
 * Actualiza una vacante (usado por JobWizard en modo edición)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionOrThrow();
    const companyId = await getSessionCompanyId();

    // @ts-ignore
    const role = session.user?.role as "RECRUITER" | "ADMIN" | string | undefined;
    if (role !== "RECRUITER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // La vacante debe pertenecer a la empresa del recruiter
    const exists = await prisma.job.findFirst({
      where: { id: params.id, companyId },
      select: { id: true, title: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Vacante no encontrada o sin permisos" }, { status: 404 });
    }

    const formData = await req.formData();

    // Campos base
    const title = getFormString(formData, "title");
    const description = getFormString(formData, "description");
    let employmentType = getFormString(formData, "employmentType") as EmploymentType;
    const locationType = (getFormString(formData, "locationType") ||
      "ONSITE") as LocationType;

    if (!title || !description) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"].includes(employmentType)) {
      employmentType = "FULL_TIME";
    }

    // Ubicación legible + estructurada
    const city = getFormString(formData, "city");
    const country = getFormString(formData, "country") || null;
    const admin1 = getFormString(formData, "admin1") || null;
    const cityNorm = getFormString(formData, "cityNorm") || null;
    const admin1Norm = getFormString(formData, "admin1Norm") || null;
    const locationLat = getFormNumber(formData, "locationLat");
    const locationLng = getFormNumber(formData, "locationLng");
    const safeLat = Number.isFinite(locationLat as number) ? (locationLat as number) : null;
    const safeLng = Number.isFinite(locationLng as number) ? (locationLng as number) : null;
    const remote = locationType === "REMOTE";

    // Compensación
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

    // Extras
    const schedule = getFormString(formData, "schedule") || null;
    const showBenefits = getFormBool(formData, "showBenefits");
    const benefitsJson = getFormJSON<any>(formData, "benefitsJson");
    const educationJson = getFormJSON<any>(formData, "educationJson");
    const minDegree = (getFormString(formData, "minDegree") ||
      null) as EducationLevel | null;
    const skillsJson = getFormJSON<any>(formData, "skillsJson");
    const certsJson = getFormJSON<any>(formData, "certsJson");

    // Compat: lista de skills string para búsquedas simples
    const skillsList: string[] = Array.isArray(skillsJson)
      ? skillsJson
          .map((s: any) =>
            typeof s?.name === "string"
              ? `${s?.required ? "Req" : "Dese"}: ${s.name}`
              : ""
          )
          .filter(Boolean)
      : [];

    // Confidencial
    const companyMode = getFormString(formData, "companyMode");
    const companyConfidential = companyMode === "confidential";

    // Actualizar
    const updated = await prisma.job.update({
      where: { id: params.id },
      data: {
        title,
        description,
        location:
          locationType === "REMOTE"
            ? "Remoto"
            : city
            ? city
            : "—",
        locationType,
        locationLat: safeLat ?? undefined,
        locationLng: safeLng ?? undefined,
        country: country || undefined,
        admin1: admin1 || undefined,
        city: city || undefined,
        cityNorm: cityNorm || undefined,
        admin1Norm: admin1Norm || undefined,

        remote,
        employmentType,

        schedule,
        benefitsJson: benefitsJson ?? undefined,
        showBenefits,

        educationJson: educationJson ?? undefined,
        minDegree: minDegree ?? undefined,

        skillsJson: skillsJson ?? undefined,
        certsJson: certsJson ?? undefined,
        skills: skillsList,

        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        currency,
        showSalary,

        companyConfidential,
        status: JobStatus.OPEN,
        updatedAt: new Date(),
      },
      select: { id: true, title: true },
    });

    // Auto-actualizar/crear plantilla ligada al título para este companyId
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
            creatorId: (session.user?.id as string) || undefined,
            lastUsedAt: new Date(),
          },
        });
      }
    } catch (e) {
      console.warn("[PATCH /api/jobs/[id]] JobTemplate save skipped:", e);
    }

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]]", err);
    return NextResponse.json({ error: "Error al actualizar la vacante" }, { status: 500 });
  }
}
