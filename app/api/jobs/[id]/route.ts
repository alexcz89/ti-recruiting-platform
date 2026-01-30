// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/server/prisma';
import { getSessionOrThrow, getSessionCompanyId } from '@/lib/server/session';
import { EmploymentType, JobStatus, EducationLevel, LocationType } from "@prisma/client";

// -------------------------------
// Helpers
// -------------------------------
const getStr = (fd: FormData, k: string) => (fd.get(k)?.toString().trim() || "");
const getNum = (fd: FormData, k: string) => {
  const v = Number(getStr(fd, k));
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
        companyId: companyId, // aquí ya es string, no null
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

    // Validar propiedad de la vacante
    const exists = await prisma.job.findFirst({
      where: {
        id: params.id,
        companyId: companyId,
      },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Vacante no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    // 🔥 Detectar si es un simple cambio de estado (JSON) o una actualización completa (FormData)
    const contentType = req.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");

    // Si es JSON, solo actualizar status
    if (isJsonRequest) {
      const body = await req.json();
      const { status } = body;

      if (!status || !["OPEN", "PAUSED", "CLOSED"].includes(status)) {
        return NextResponse.json(
          { error: "Estado inválido" },
          { status: 400 }
        );
      }

      await prisma.job.update({
        where: { id: params.id },
        data: { 
          status: status as JobStatus,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ ok: true });
    }

    // Para FormData (actualización completa)
    const fd = await req.formData();

    // Básicos
    const title = getStr(fd, "title");
    const description = getStr(fd, "description");

    if (!title || !description) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const locationType = (getStr(fd, "locationType") || "ONSITE") as LocationType;
    const employmentType = (getStr(fd, "employmentType") ||
      "FULL_TIME") as EmploymentType;

    // Ubicación estructurada
    const city = getStr(fd, "city") || null;
    const country = getStr(fd, "country") || null;
    const admin1 = getStr(fd, "admin1") || null;
    const cityNorm = getStr(fd, "cityNorm") || null;
    const admin1Norm = getStr(fd, "admin1Norm") || null;

    const lat = getNum(fd, "locationLat");
    const lng = getNum(fd, "locationLng");
    const remote = locationType === "REMOTE";

    // Sueldo
    const salaryMin = getNum(fd, "salaryMin");
    const salaryMax = getNum(fd, "salaryMax");
    const showSalary = getBool(fd, "showSalary");
    const currency = getStr(fd, "currency") || "MXN";

    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      return NextResponse.json(
        { error: "El sueldo mínimo no puede ser mayor que el máximo" },
        { status: 400 }
      );
    }

    // Extras
    const schedule = getStr(fd, "schedule") || null;
    const showBenefits = getBool(fd, "showBenefits");
    const benefitsJson = getJson(fd, "benefitsJson");
    const educationJson = getJson(fd, "educationJson");
    const minDegree =
      (getStr(fd, "minDegree") as EducationLevel) || null;
    const skillsJson = getJson(fd, "skillsJson");
    const certsJson = getJson(fd, "certsJson");

    // Lista plana para búsquedas
    const skillsList =
      Array.isArray(skillsJson)
        ? skillsJson
            .map((s: any) =>
              s?.name ? `${s?.required ? "Req" : "Dese"}: ${s.name}` : ""
            )
            .filter(Boolean)
        : [];

    // Confidencial
    const companyConfidential = getStr(fd, "companyMode") === "confidential";

    // -------------------------
    // UPDATE
    // -------------------------
    const updated = await prisma.job.update({
      where: { id: params.id },
      data: {
        title,
        description,
        location: remote ? "Remoto" : city ? city : "—",
        locationType,
        locationLat: lat ?? undefined,
        locationLng: lng ?? undefined,
        country: country || undefined,
        admin1: admin1 || undefined,
        city: city || undefined,
        cityNorm: cityNorm || undefined,
        admin1Norm: admin1Norm || undefined,

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
        minDegree: minDegree ?? undefined,

        skillsJson: skillsJson ?? undefined,
        certsJson: certsJson ?? undefined,
        skills: skillsList,

        companyConfidential,
        status: JobStatus.OPEN,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    // -------------------------
    // Autoguardar plantilla
    // -------------------------
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
          companyId: companyId,
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
      console.warn("JobTemplate update skipped:", err);
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