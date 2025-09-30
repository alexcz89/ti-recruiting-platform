// app/dashboard/jobs/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobWizard from "./JobWizard";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
import { geocodeCityToPoint } from "@/lib/geo";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/jobs/new`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  // Catálogos centralizados (DB con fallback)
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Carga de compañía del reclutador (si existe)
  let myCompanyName: string | null = null;
  let myCompanyId: string | null = null;
  const me = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true, companyId: true, company: { select: { id: true, name: true } } },
  });
  if (me?.company) {
    myCompanyName = me.company.name;
    myCompanyId = me.company.id;
  }

  // ---------------- Zod schemas (server) ----------------
  const BaseSchema = z.object({
    title: z.string().trim().min(3, "El título es muy corto"),
    companyMode: z.enum(["own", "other", "confidential"]).default("own"),
    companyOtherName: z.string().trim().max(120).optional().default(""),

    locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).default("REMOTE"),
    city: z.string().trim().max(140).optional().default(""),

    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]).default("FULL_TIME"),
    schedule: z.string().trim().max(120).optional().default(""),

    currency: z.enum(["MXN", "USD"]).default("MXN"),
    showSalary: z.string().optional().transform((v) => v === "true"),
    salaryMin: z.string().optional(),
    salaryMax: z.string().optional(),

    showBenefits: z.string().optional().transform((v) => v === "true"),
    benefitsJson: z.string().optional().default("{}"),

    description: z.string().trim(),
    responsibilities: z.string().trim().optional().default(""),

    skillsJson: z.string().optional().default("[]"),
    certsJson: z.string().optional().default("[]"),
  });

  // -------- Server Action: crear vacante --------
  async function createAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user?.email) return { error: "No autenticado" };

    // Mapear FormData -> objeto para Zod
    const obj = Object.fromEntries(fd.entries()) as Record<string, string>;
    const parsed = BaseSchema.safeParse({
      title: obj.title,
      companyMode: obj.companyMode,
      companyOtherName: obj.companyOtherName,

      locationType: obj.locationType,
      city: obj.city,

      employmentType: obj.employmentType,
      schedule: obj.schedule,

      currency: obj.currency,
      showSalary: obj.showSalary,
      salaryMin: obj.salaryMin,
      salaryMax: obj.salaryMax,

      showBenefits: obj.showBenefits,
      benefitsJson: obj.benefitsJson,

      description: obj.description,
      responsibilities: obj.responsibilities,

      skillsJson: obj.skillsJson,
      certsJson: obj.certsJson,
    });

    if (!parsed.success) {
      const first = parsed.error.errors[0];
      return { error: first?.message || "Datos inválidos" };
    }

    const data = parsed.data;

    // Validaciones adicionales
    if ((data.locationType === "HYBRID" || data.locationType === "ONSITE") && !data.city) {
      return { error: "Debes indicar la ciudad para vacantes híbridas o presenciales." };
    }

    // Parseo de salarios a number|null
    const salaryMin = data.salaryMin ? Number(data.salaryMin) : null;
    const salaryMax = data.salaryMax ? Number(data.salaryMax) : null;

    if (Number.isNaN(salaryMin as number) || Number.isNaN(salaryMax as number)) {
      return { error: "El salario debe ser numérico." };
    }
    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      return { error: "El sueldo mínimo no puede ser mayor que el máximo." };
    }

    // Reglas de descripción
    if (data.description.replace(/\s+/g, "").length < 50) {
      return { error: "La descripción debe tener al menos 50 caracteres." };
    }

    // skills: JSON de [{name, required}]
    let parsedSkills: Array<{ name: string; required: boolean }> = [];
    try {
      parsedSkills = JSON.parse(data.skillsJson || "[]");
      if (!Array.isArray(parsedSkills)) parsedSkills = [];
    } catch {
      parsedSkills = [];
    }
    const skills: string[] = parsedSkills
      .map((s) => ({
        name: String(s?.name || "").trim(),
        required: !!s?.required,
      }))
      .filter((s) => !!s.name)
      .map((s) => (s.required ? `Req: ${s.name}` : `Nice: ${s.name}`));

    // certifications (opcional) JSON de string[]
    let certs: string[] = [];
    try {
      const tmp = JSON.parse(data.certsJson || "[]");
      if (Array.isArray(tmp)) certs = tmp.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {
      certs = [];
    }

    // companyId a utilizar:
    let companyIdToUse: string | null = null;
    if (data.companyMode === "own" && me?.companyId) {
      companyIdToUse = me.companyId!;
    } else if (data.companyMode === "confidential") {
      const c = await prisma.company.upsert({
        where: { name: "Confidencial" },
        update: {},
        create: { name: "Confidencial" },
        select: { id: true },
      });
      companyIdToUse = c.id;
    } else if (data.companyMode === "other" && data.companyOtherName) {
      const c = await prisma.company.upsert({
        where: { name: data.companyOtherName },
        update: {},
        create: { name: data.companyOtherName },
        select: { id: true },
      });
      companyIdToUse = c.id;
    } else if (me?.companyId) {
      companyIdToUse = me.companyId;
    }

    if (!companyIdToUse) {
      return { error: "No se pudo resolver la empresa para la vacante." };
    }

    // Normalizamos location final (string visible)
    const remote = data.locationType === "REMOTE";
    const location = remote
      ? "Remoto"
      : `${data.locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${data.city}`;

    // Geocoding para guardar lat/lng (solo si no es remoto y hay ciudad)
    let locationLat: number | null = null;
    let locationLng: number | null = null;
    if (!remote && data.city) {
      try {
        const pt = await geocodeCityToPoint(data.city);
        if (pt) {
          locationLat = pt.lat;
          locationLng = pt.lng;
        }
      } catch {
        locationLat = null;
        locationLng = null;
      }
    }

    // Inyectamos meta (sueldo/benefits/responsabilidades/certs) a la descripción
    const descWithMeta =
      data.description +
      `\n\n---\n[Meta]\n` +
      `showSalary=${data.showSalary}; currency=${data.currency}; salaryMin=${salaryMin ?? ""}; salaryMax=${salaryMax ?? ""}\n` +
      `employmentType=${data.employmentType}; schedule=${data.schedule}\n` +
      `showBenefits=${data.showBenefits}; benefits=${data.benefitsJson || "{}"}\n` +
      `responsibilities=${data.responsibilities || ""}\n` +
      `certifications=${JSON.stringify(certs)}\n`;

    // recruiter
    let recruiterId: string | undefined = undefined;
    if (me?.id) recruiterId = me.id;

    await prisma.job.create({
      data: {
        title: data.title,
        companyId: companyIdToUse,
        location,
        employmentType: data.employmentType as any,
        seniority: "MID", // podrías hacer esto seleccionable en el wizard
        description: descWithMeta,
        skills,
        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        currency: data.currency,
        remote,
        locationLat,
        locationLng,
        recruiterId,
      },
      select: { id: true },
    });

    // Revalidate listados
    revalidatePath("/jobs");
    revalidatePath("/dashboard/jobs");

    // Redirige al listado del dashboard (el wizard puede mostrar toast de éxito antes)
    redirect("/dashboard/jobs");
  }

  return (
    <main className="max-w-4xl">
      <h2 className="mb-4 text-lg font-semibold">Nueva vacante</h2>
      <JobWizard
        onSubmit={createAction}
        presetCompany={{ id: myCompanyId, name: myCompanyName }}
        skillsOptions={skillsOptions}
        certOptions={certOptions}
      />
    </main>
  );
}
