// app/api/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCompanyId, getSessionOrThrow } from "@/lib/session";
import {
  EmploymentType,
  JobStatus,
  EducationLevel,
  LocationType,
} from "@prisma/client";

// Helpers
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // -------- Detalle por ID --------
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
          company: { select: { name: true } },
        },
      });
      if (!job) return NextResponse.json({ job: null });

      return NextResponse.json({
        job: {
          id: job.id,
          title: job.title,
          company: job.companyConfidential ? "Confidencial" : job.company?.name ?? null,
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
          // para compatibilidad y también estructurado
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
        },
      });
    }

    // -------- Lista + filtros --------
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
    const cursor = searchParams.get("cursor") ?? undefined;

    const q = (searchParams.get("q") || "").trim();
    const location = (searchParams.get("location") || "").trim();

    const remoteParam = searchParams.get("remote");
    const remote =
      remoteParam === "true" ? true : remoteParam === "false" ? false : undefined;

    const employmentType = (searchParams.get("employmentType") ||
      "") as "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "";

    const sort = (searchParams.get("sort") as "recent" | "updated") || "recent";

    const where: any = { status: JobStatus.OPEN };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { skills: { hasSome: [q] } }, // compat text array
      ];
    }
    if (location) {
      // match por string legible o por campos estructurados
      where.OR = [
        ...(where.OR || []),
        { location: { contains: location, mode: "insensitive" } },
        { city: { contains: location, mode: "insensitive" } },
        { admin1: { contains: location, mode: "insensitive" } },
        { country: { contains: location, mode: "insensitive" } },
      ];
    }
    if (remote !== undefined) where.remote = remote;
    if (employmentType) where.employmentType = employmentType;

    const orderBy =
      sort === "updated" ? [{ updatedAt: "desc" as const }] : [{ createdAt: "desc" as const }];

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
        skills: true,
        salaryMin: true,
        salaryMax: true,
        showSalary: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        companyConfidential: true,
        company: { select: { name: true } },
      },
    });

    const items = page.slice(0, limit).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.companyConfidential ? "Confidencial" : j.company?.name ?? null,
      location: j.location,
      locationType: j.locationType,
      country: j.country,
      admin1: j.admin1,
      city: j.city,
      remote: j.remote,
      employmentType: j.employmentType,
      description: j.description,
      skills: j.skills,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      showSalary: j.showSalary,
      currency: j.currency,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));

    let nextCursor: string | null = null;
    if (page.length > limit) nextCursor = page[limit].id;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/jobs
 * Crea una vacante y la liga al recruiter autenticado y a su companyId.
 * Acepta FormData (desde JobWizard).
 *
 * BLINDAJES ANTI-DUPLICADOS:
 *  - Si llega 'jobId' en el FormData => 409 (esto viene del editor; no se permite crear).
 *  - Idempotencia por ventana corta: si existe una vacante OPEN con mismo (title, companyId, recruiterId)
 *    creada en los últimos 3 minutos, devolvemos esa misma en lugar de crear otra.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    // @ts-ignore
    const role = session.user?.role as "RECRUITER" | "ADMIN" | string | undefined;
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

    // ---- FormData
    const formData = await req.formData();

    // 1) Si viene desde el editor, no permitimos crear
    const incomingJobId = getFormString(formData, "jobId");
    if (incomingJobId) {
      return NextResponse.json(
        { error: "Esta operación es de edición. Usa el endpoint de actualización." },
        { status: 409 }
      );
    }

    // Requeridos mínimos
    const title = getFormString(formData, "title");
    const description = getFormString(formData, "description");
    let employmentType = getFormString(formData, "employmentType") as EmploymentType;
    const locationType = (getFormString(formData, "locationType") ||
      "ONSITE") as LocationType;

    if (!title || !description) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Fallback seguro para employmentType
    if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"].includes(employmentType)) {
      employmentType = "FULL_TIME";
    }

    // Ubicación legible + estructurada (opcionales)
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

    // Validación: rango de sueldo coherente
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

    // Compat: array de skills legible para búsquedas simples (a partir de skillsJson)
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
    const companyMode = getFormString(formData, "companyMode"); // "own" | "confidential"
    const companyConfidential = companyMode === "confidential";

    // 2) Idempotencia por ventana corta
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
      return NextResponse.json({ ok: true, id: existing.id, deduped: true });
    }

    // 3) Crear
    const job = await prisma.job.create({
      data: {
        title,
        description,
        // Ubicación legible (fallback a "Remoto" o ciudad/cadena)
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
        skills: skillsList, // compat

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

    // 4) Auto-guardar/actualizar plantilla (no bloquear si falla)
    try {
      const payloadForTemplate = {
        // Paso 1
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
        // Paso 2
        employmentType,
        schedule,
        // Paso 3
        benefitsJson: benefitsJson ?? {},
        // Paso 4
        description,
        education: educationJson ?? [],
        minDegree,
        skills: Array.isArray(skillsJson) ? skillsJson : [],
        certs: Array.isArray(certsJson) ? certsJson : [],
        // metadatos opcionales
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
    return NextResponse.json({ error: "Error al crear la vacante" }, { status: 500 });
  }
}
