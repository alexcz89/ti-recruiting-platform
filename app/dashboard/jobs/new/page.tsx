// app/dashboard/jobs/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobWizard from "./JobWizard";
import { prisma } from "@/lib/prisma";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";

// Si usas geocoding en server action legacy, deja importado.
// import { geocodeCityToPoint } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/jobs/new");
  const role = (session?.user as any)?.role;
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  // Trae opciones de skills/certs
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Empresa del usuario para habilitar "Mi empresa"
  const userCompanyId = (session.user as any)?.companyId as string | undefined;
  const userCompany = userCompanyId
    ? await prisma.company.findUnique({
        where: { id: userCompanyId },
        select: { id: true, name: true },
      })
    : null;

  // ─────────────────────────────────────────────────────────
  // 1) Intentar cargar JobTemplate
  // ─────────────────────────────────────────────────────────
  const rawTemplates = userCompanyId
    ? await prisma.jobTemplate.findMany({
        where: { companyId: userCompanyId },
        orderBy: [{ updatedAt: "desc" }],
        take: 25,
        select: {
          id: true,
          title: true,
          payload: true,
        },
      })
    : [];

  // Normaliza payload de JobTemplate al formato de TemplateJob del Wizard
  const templateFromPayload = (t: { id: string; title: string | null; payload: any }) => {
    const p: any = t.payload || {};
    return {
      id: t.id,
      title: t.title ?? p.title ?? undefined,
      // Ubicación
      locationType: p.locationType ?? p.location_type ?? undefined,
      city: p.city ?? p.location ?? null,
      country: p.country ?? null,
      admin1: p.admin1 ?? null,
      cityNorm: p.cityNorm ?? null,
      admin1Norm: p.admin1Norm ?? null,
      locationLat: p.locationLat ?? null,
      locationLng: p.locationLng ?? null,
      // Compensación
      currency: p.currency ?? undefined,
      salaryMin: p.salaryMin ?? null,
      salaryMax: p.salaryMax ?? null,
      showSalary: p.showSalary ?? null,
      // Tipo + horario
      employmentType: p.employmentType ?? undefined,
      schedule: p.schedule ?? null,
      // Prestaciones
      benefitsJson: p.benefitsJson ?? null,
      // Contenido
      description: p.description ?? null,
      education: p.educationJson ?? p.education ?? null,
      minDegree: p.minDegree ?? null,
      skills: p.skillsJson ?? p.skills ?? null,
      certs: p.certsJson ?? p.certifications ?? null,
    };
  };

  let templates =
    rawTemplates.length > 0
      ? rawTemplates.map(templateFromPayload)
      : [];

  // ─────────────────────────────────────────────────────────
  // 2) Fallback: derivar “plantillas” de vacantes anteriores (Job)
  // ─────────────────────────────────────────────────────────
  if (templates.length === 0 && userCompanyId) {
    const recentJobs = await prisma.job.findMany({
      where: { companyId: userCompanyId },
      orderBy: [{ updatedAt: "desc" }],
      take: 25,
      select: {
        id: true,
        title: true,
        // Ubicación
        locationType: true,
        city: true,
        country: true,
        admin1: true,
        cityNorm: true,
        admin1Norm: true,
        locationLat: true,
        locationLng: true,
        // Compensación
        currency: true,
        salaryMin: true,
        salaryMax: true,
        showSalary: true,
        // Tipo + horario
        employmentType: true,
        schedule: true,
        // Prestaciones
        benefitsJson: true,
        // Contenido
        description: true,
        educationJson: true,
        minDegree: true,
        skillsJson: true,
        certsJson: true,
      },
    });

    templates = recentJobs.map((j) => ({
      id: j.id,
      title: j.title ?? undefined,
      locationType: (j.locationType as any) ?? undefined,
      city: j.city ?? null,
      country: j.country ?? null,
      admin1: j.admin1 ?? null,
      cityNorm: j.cityNorm ?? null,
      admin1Norm: j.admin1Norm ?? null,
      locationLat: j.locationLat ?? null,
      locationLng: j.locationLng ?? null,
      currency: (j.currency as any) ?? undefined,
      salaryMin: j.salaryMin ?? null,
      salaryMax: j.salaryMax ?? null,
      showSalary: j.showSalary ?? null,
      employmentType: (j.employmentType as any) ?? undefined,
      schedule: j.schedule ?? null,
      benefitsJson: (j.benefitsJson as any) ?? null,
      description: j.description ?? null,
      education: (j.educationJson as any) ?? null,
      minDegree: (j.minDegree as any) ?? null,
      skills: (j.skillsJson as any) ?? null,
      certs: (j.certsJson as any) ?? null,
    }));
  }

  // ─────────────────────────────────────────────────────────
  // Server Action (solo se usa en modo edición dentro del wizard)
  // Para “new” no se utiliza; el wizard hace POST a /api/jobs
  // ─────────────────────────────────────────────────────────
  async function createAction(_fd: FormData) {
    "use server";
    // Este server action se mantiene por compatibilidad con el JobWizard cuando
    // está en modo edición. Para “new” el wizard NO llama onSubmit.
    return { error: "Método no disponible" };
  }

  return (
    <main className="max-w-4xl p-6 space-y-6">
      <h2 className="text-2xl font-bold">Publicar vacante</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Llena los campos y publica la nueva vacante.
      </p>

      <JobWizard
        onSubmit={createAction}
        // presetCompany: si el usuario tiene empresa, la pasamos; si no, null
        presetCompany={{ id: userCompany?.id ?? null, name: userCompany?.name ?? null }}
        skillsOptions={skillsOptions}
        certOptions={certOptions}
        // ➕ pasamos plantillas al wizard (JobTemplate o fallback de Jobs)
        templates={templates}
      />
    </main>
  );
}
