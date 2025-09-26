// app/dashboard/jobs/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobWizard from "./JobWizard";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
import { geocodeCityToPoint } from "@/lib/geo"; // ⬅️ NUEVO

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

  // -------- Server Action: crear vacante --------
  async function createAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user?.email) return { error: "No autenticado" };

    // Paso 1
    const title = String(fd.get("title") || "").trim();
    const companyMode = String(fd.get("companyMode") || "own"); // own | other | confidential
    const companyOtherName = String(fd.get("companyOtherName") || "").trim();
    const locationType = String(fd.get("locationType") || "REMOTE"); // REMOTE | HYBRID | ONSITE
    const city = String(fd.get("city") || "").trim();
    const currency = (String(fd.get("currency") || "MXN") as "MXN" | "USD");
    const showSalary = String(fd.get("showSalary") || "false") === "true";
    const salaryMin = fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null;
    const salaryMax = fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null;

    if (!title) return { error: "Falta el nombre de la vacante." };
    if (!["REMOTE", "HYBRID", "ONSITE"].includes(locationType)) {
      return { error: "Ubicación inválida." };
    }
    if ((locationType === "HYBRID" || locationType === "ONSITE") && !city) {
      return { error: "Debes indicar la ciudad para vacantes híbridas o presenciales." };
    }
    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      return { error: "El sueldo mínimo no puede ser mayor que el máximo." };
    }

    // Paso 2
    const employmentType = String(fd.get("employmentType") || "FULL_TIME"); // FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP
    const schedule = String(fd.get("schedule") || "").trim(); // opcional

    // Paso 3 (prestaciones)
    const showBenefits = String(fd.get("showBenefits") || "false") === "true";
    const benefitsJson = String(fd.get("benefitsJson") || "{}");

    // Paso 4
    const description = String(fd.get("description") || "").trim();
    const responsibilities = String(fd.get("responsibilities") || "").trim();
    if (description.replace(/\s+/g, "").length < 50) {
      return { error: "La descripción debe tener al menos 50 caracteres." };
    }

    // skills: JSON de [{name, required}]
    const skillsJson = String(fd.get("skillsJson") || "[]");
    let parsedSkills: Array<{ name: string; required: boolean }> = [];
    try {
      parsedSkills = JSON.parse(skillsJson);
    } catch {
      parsedSkills = [];
    }
    const skills: string[] = parsedSkills.map((s) =>
      s.required ? `Req: ${s.name}` : `Nice: ${s.name}`
    );

    // certifications (opcional) JSON de string[]
    const certsJson = String(fd.get("certsJson") || "[]");
    let certs: string[] = [];
    try {
      certs = JSON.parse(certsJson);
    } catch {
      certs = [];
    }

    // companyId a utilizar:
    let companyIdToUse: string | null = null;
    if (companyMode === "own" && me?.companyId) {
      companyIdToUse = me.companyId!;
    } else if (companyMode === "confidential") {
      const c = await prisma.company.upsert({
        where: { name: "Confidencial" },
        update: {},
        create: { name: "Confidencial" },
        select: { id: true },
      });
      companyIdToUse = c.id;
    } else if (companyMode === "other" && companyOtherName) {
      const c = await prisma.company.upsert({
        where: { name: companyOtherName },
        update: {},
        create: { name: companyOtherName },
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
    const remote = locationType === "REMOTE";
    const location = remote
      ? "Remoto"
      : `${locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${city}`;

    // 🔎 Geocoding para guardar lat/lng (solo si no es remoto y hay ciudad)
    let locationLat: number | null = null;
    let locationLng: number | null = null;
    if (!remote && city) {
      try {
        const pt = await geocodeCityToPoint(city);
        if (pt) {
          locationLat = pt.lat;
          locationLng = pt.lng;
        }
      } catch {
        // Si falla el geocoding no bloqueamos la creación
        locationLat = null;
        locationLng = null;
      }
    }

    // Inyectamos meta (sueldo/benefits/responsabilidades/certs) a la descripción
    const descWithMeta =
      description +
      `\n\n---\n[Meta]\n` +
      `showSalary=${showSalary}; currency=${currency}; salaryMin=${salaryMin ?? ""}; salaryMax=${salaryMax ?? ""}\n` +
      `employmentType=${employmentType}; schedule=${schedule}\n` +
      `showBenefits=${showBenefits}; benefits=${benefitsJson}\n` +
      `responsibilities=${responsibilities}\n` +
      `certifications=${JSON.stringify(certs)}\n`;

    // recruiter
    let recruiterId: string | undefined = undefined;
    if (me?.id) recruiterId = me.id;

    await prisma.job.create({
      data: {
        title,
        companyId: companyIdToUse,
        location,
        employmentType: employmentType as any,
        seniority: "MID",
        description: descWithMeta,
        skills,
        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        currency,
        remote,
        locationLat, // ⬅️ NUEVO
        locationLng, // ⬅️ NUEVO
        recruiterId,
      },
      select: { id: true },
    });

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
