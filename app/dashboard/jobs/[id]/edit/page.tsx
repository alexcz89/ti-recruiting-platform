// app/dashboard/jobs/[id]/edit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from '@/lib/server/prisma';
import JobWizard from "../../new/JobWizard";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/server/skills";
import { geocodeCityToPoint } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: { id: string } };

export default async function EditJobPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/signin?callbackUrl=/dashboard/jobs/${params.id}/edit`);

  const role = (session?.user as any)?.role as
    | "RECRUITER"
    | "ADMIN"
    | string
    | undefined;
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const sessionUser = session.user as any;
  const sessionCompanyId = sessionUser?.companyId as string | undefined;

  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Ownership estricto para RECRUITER
  const jobInclude = {
    company: true,
    assessments: {
      select: { templateId: true },
      orderBy: { createdAt: "asc" as const },
    },
  } as const;

  const job =
    role === "RECRUITER"
      ? await prisma.job.findFirst({
          where: { id: params.id, companyId: sessionCompanyId ?? undefined },
          include: jobInclude,
        })
      : await prisma.job.findUnique({
          where: { id: params.id },
          include: jobInclude,
        });

  if (!job) notFound();

  // Para "Mi empresa" en el wizard
  const userCompany = sessionCompanyId
    ? await prisma.company.findUnique({
        where: { id: sessionCompanyId },
        select: { id: true, name: true },
      })
    : null;

  /* ---------- Meta parser robusto (igual que JobDetailPanel) ---------- */
  type MetaMap = { [key: string]: any };

  function parseMetaFromDescription(
    description: string | null | undefined
  ): { meta: MetaMap; mainDesc: string } {
    const raw = description ?? "";
    const match = raw.match(/---\s*\[Meta\]([\s\S]*)$/i);
    if (!match) {
      return { meta: {}, mainDesc: raw.trim() };
    }

    const metaBlock = match[1].trim();
    const tokens = metaBlock
      .split(/\r?\n/)
      .flatMap((l) => l.split(";"))
      .map((t) => t.trim())
      .filter(Boolean);

    const parsed: MetaMap = {};
    for (const tok of tokens) {
      const i = tok.indexOf("=");
      if (i < 0) continue;
      const key = tok.slice(0, i).trim();
      const valRaw = tok.slice(i + 1).trim();

      if (valRaw === "true" || valRaw === "false") {
        parsed[key] = valRaw === "true";
        continue;
      }
      if (/^-?\d+(\.\d+)?$/.test(valRaw)) {
        parsed[key] = Number(valRaw);
        continue;
      }
      if (valRaw === "" || valRaw.toLowerCase() === "null") {
        parsed[key] = null;
        continue;
      }
      if (valRaw.startsWith("{") || valRaw.startsWith("[")) {
        try {
          parsed[key] = JSON.parse(valRaw);
          continue;
        } catch {
          /* ignore */
        }
      }
      parsed[key] = valRaw;
    }

    const mainDesc = raw.slice(0, match.index).trim();
    return { meta: parsed, mainDesc };
  }

  function deserializeSkills(skills: string[] | null) {
    return (skills || []).map((s) => {
      const m = s.match(/^(?:Req|Nice)\s*:\s*(.+)$/i);
      const required = /^Req/i.test(s);
      return { name: m ? m[1] : s, required };
    });
  }

  const { meta, mainDesc } = parseMetaFromDescription(job.description || "");
  const description = mainDesc;

  const certs: string[] = Array.isArray(meta.certifications)
    ? meta.certifications
    : meta.certifications
    ? [meta.certifications]
    : [];

  const metaBenefits =
    meta.benefits && typeof meta.benefits === "object" ? meta.benefits : null;

  const benefitsJson: Record<string, any> =
    (job.benefitsJson && Object.keys(job.benefitsJson as any).length > 0
      ? (job.benefitsJson as any)
      : metaBenefits || {}) ?? {};

  const showSalary =
    typeof meta.showSalary === "boolean"
      ? meta.showSalary
      : !!(job.salaryMin || job.salaryMax);

  const schedule: string =
    (meta.schedule as string | undefined) ?? job.schedule ?? "";

  const showBenefits: boolean =
    typeof meta.showBenefits === "boolean"
      ? meta.showBenefits
      : job.showBenefits ?? false;

  // 👇 Idiomas desde meta (si existen)
  const languages: any[] = Array.isArray(meta.languages)
    ? meta.languages
    : meta.languages
    ? [meta.languages]
    : [];

  // Usar campos modernos del schema (locationType, city) con fallback al campo legacy location
  const locationType: "REMOTE" | "HYBRID" | "ONSITE" =
    ((job as any).locationType as "REMOTE" | "HYBRID" | "ONSITE") ??
    (job.remote ? "REMOTE" : "ONSITE");

  let city = ((job as any).city as string | null) ?? "";
  if (!city && !job.remote && job.location) {
    // fallback legacy: parsear del string location
    city = job.location.split("·")[1]?.trim() || job.location;
  }

  // IDs de assessments ya asignados al job
  const existingAssessmentIds: string[] = ((job as any).assessments ?? [])
    .map((a: { templateId: string }) => a.templateId);

  const wizardInitial = {
    id: job.id,
    title: job.title,
    companyMode: job.companyConfidential ? "confidential" : "own",
    locationType,
    city,
    // Campos modernos de ubicación
    country: (job as any).country ?? "",
    admin1: (job as any).admin1 ?? "",
    cityNorm: (job as any).cityNorm ?? "",
    admin1Norm: (job as any).admin1Norm ?? "",
    locationLat: (job as any).locationLat ?? null,
    locationLng: (job as any).locationLng ?? null,
    // Compensación
    currency: job.currency || "MXN",
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    showSalary,
    employmentType: job.employmentType || "FULL_TIME",
    schedule,
    // Prestaciones
    showBenefits,
    benefitsJson,
    // Descripción (campos modernos)
    description,
    descriptionHtml: (job as any).descriptionHtml ?? "",
    // Skills
    skills: Array.isArray((job as any).skillsJson)
      ? (job as any).skillsJson
      : deserializeSkills(job.skills),
    certs,
    // Educación
    minDegree: (job as any).minDegree ?? null,
    education: Array.isArray((job as any).educationJson)
      ? ((job as any).educationJson as any[])
      : [],
    // Idiomas
    languages,
    // ✅ Assessments ya asignados
    assessmentTemplateIds: existingAssessmentIds,
  };

  // ============= Server Action: UPDATE (nunca create) =============
  async function updateAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    const currentRole = (s?.user as any)?.role as
      | "RECRUITER"
      | "ADMIN"
      | string
      | undefined;
    if (!s?.user || (currentRole !== "RECRUITER" && currentRole !== "ADMIN")) {
      return { error: "No autenticado o sin permisos." };
    }

    const jobIdFromForm = (fd.get("jobId") || "").toString();
    const jobId = jobIdFromForm || params.id;
    if (jobIdFromForm && jobIdFromForm !== params.id) {
      return { error: "Inconsistencia de ID de vacante." };
    }

    if (currentRole === "RECRUITER") {
      const canEdit = await prisma.job.findFirst({
        where: { id: jobId, companyId: (s.user as any)?.companyId ?? undefined },
        select: { id: true },
      });
      if (!canEdit) return { error: "No tienes acceso a esta vacante." };
    }

    const companyMode = String(fd.get("companyMode") || "confidential");
    const title = String(fd.get("title") || "").trim();
    const locationType = String(fd.get("locationType") || "REMOTE");
    const city = String(fd.get("city") || "").trim();
    const showSalary = fd.get("showSalary") === "true";
    const currency = String(fd.get("currency") || "MXN");
    const salaryMin = fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null;
    const salaryMax = fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null;
    const description = String(fd.get("description") || "");
    const responsibilities = String(fd.get("responsibilities") || "");
    const employmentType = String(fd.get("employmentType") || "FULL_TIME");
    const showBenefits = fd.get("showBenefits") === "true";
    const benefitsJsonStr = String(fd.get("benefitsJson") || "{}");
    const skillsJson = String(fd.get("skillsJson") || "[]");
    const certsJson = String(fd.get("certsJson") || "[]");
    const schedule = String(fd.get("schedule") || "");

    const hasMinDegreeField = fd.has("minDegree");
    const minDegreeField = String(fd.get("minDegree") || "").trim();
    const educationJsonStr = String(fd.get("educationJson") || "[]");

    // 👇 idiomas desde el form
    const languagesJson = String(fd.get("languagesJson") || "[]");

    // ================================
    // MULTI ASSESSMENTS (FIX)
    // ================================
    // Parseo robusto: soporta fd.append por ID (formato B) y fd.set+JSON.stringify (formato A)
    let assessmentTemplateIds: string[] = [];
    const fromGetAll = fd.getAll("assessmentTemplateIds") as string[];

    if (fromGetAll.length === 1 && fromGetAll[0].trim().startsWith("[")) {
      // Formato A: JSON string
      try {
        const parsed = JSON.parse(fromGetAll[0]);
        if (Array.isArray(parsed)) {
          assessmentTemplateIds = parsed
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean);
        }
      } catch { /* ignora - sigue con [] */ }
    } else if (fromGetAll.length > 0) {
      // Formato B: múltiples fd.append
      assessmentTemplateIds = fromGetAll.filter((id) => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
    }

    // fallback campo singular
    const singleAssessment = String(fd.get("assessmentTemplateId") || "");
    if (assessmentTemplateIds.length === 0 && singleAssessment) {
      assessmentTemplateIds = [singleAssessment];
    }
    assessmentTemplateIds = Array.from(new Set(assessmentTemplateIds));

    if (!title || !description)
      return { error: "Faltan campos obligatorios (título y descripción)." };

    let parsedSkills: Array<{ name: string; required: boolean }> = [];
    try {
      parsedSkills = JSON.parse(skillsJson || "[]");
    } catch {
      return { error: "Formato inválido en skillsJson." };
    }
    const skills = parsedSkills.map((x) =>
      x.required ? `Req: ${x.name}` : `Nice: ${x.name}`
    );

    let certsArr: string[] = [];
    try {
      certsArr = JSON.parse(certsJson || "[]");
    } catch {
      certsArr = [];
    }

    let parsedBenefits: Record<string, any> = {};
    try {
      parsedBenefits = JSON.parse(benefitsJsonStr || "{}");
    } catch {
      parsedBenefits = {};
    }

    const minDegree = minDegreeField || null;

    let educationJson: any[] = [];
    try {
      educationJson = JSON.parse(educationJsonStr || "[]");
    } catch {
      educationJson = [];
    }

    // 👇 parseo de idiomas
    let languagesArr: any[] = [];
    try {
      languagesArr = JSON.parse(languagesJson || "[]");
    } catch {
      languagesArr = [];
    }

    const remote = locationType === "REMOTE";
    const loc = remote
      ? "Remoto"
      : `${locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${city}`;

    let locationLat: number | null = null;
    let locationLng: number | null = null;
    if (!remote && city) {
      const pt = await geocodeCityToPoint(city, "mx");
      if (pt) {
        locationLat = pt.lat;
        locationLng = pt.lng;
      }
    }

    let companyConnect: { connect: { id: string } } | undefined = undefined;
    const sessCompanyId = (s.user as any)?.companyId as string | undefined;
    if (companyMode === "own") {
      if (!sessCompanyId) return { error: "Tu perfil no tiene una empresa asociada." };
      companyConnect = { connect: { id: sessCompanyId } };
    } else {
      const label = "Confidencial";
      const existing = await prisma.company.findFirst({
        where: { name: label },
        select: { id: true },
      });
      const confId = existing
        ? existing.id
        : (
            await prisma.company.create({
              data: { name: label },
              select: { id: true },
            })
          ).id;
      companyConnect = { connect: { id: confId } };
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          title,
          location: loc,
          locationType: locationType as any,
          city: remote ? null : city || null,
          remote,
          employmentType: employmentType as any,
          description,
          descriptionHtml: String(fd.get("descriptionHtml") || "") || null,
          skills,
          skillsJson: parsedSkills,
          salaryMin: salaryMin ?? undefined,
          salaryMax: salaryMax ?? undefined,
          currency,
          showSalary,
          schedule: schedule || null,
          showBenefits,
          benefitsJson: parsedBenefits,
          ...(hasMinDegreeField ? { minDegree: minDegree as any } : {}),
          educationJson,
          certsJson: certsArr,
          locationLat,
          locationLng,
          recruiterId: (s.user as any)?.id,
          ...(companyConnect ? { company: companyConnect } : {}),
        },
      });

      // 🔥 BORRAR assessments anteriores
      await tx.jobAssessment.deleteMany({
        where: { jobId },
      });

      // 🔥 INSERTAR nuevos
      if (assessmentTemplateIds.length > 0) {
        await tx.jobAssessment.createMany({
          data: assessmentTemplateIds.map((templateId) => ({
            jobId,
            templateId,
            isRequired: true,
            triggerAt: "AFTER_APPLY",
          })),
        });
      }
    });

    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath(`/dashboard/jobs`);
    return { ok: true, redirectTo: "/dashboard/jobs" };
  }

  return (
    <main className="w-full max-w-none p-0" key={`edit-${job.id}`}>
      {/* Container ancho (igual idea que /new) para evitar que el wizard quede “aplastado” */}
      <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-10 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Editar vacante</h2>
          <p className="text-sm text-zinc-600 mt-1">
            Modifica los campos necesarios y guarda los cambios.
          </p>
        </div>

        <JobWizard
          onSubmit={updateAction}
          presetCompany={
            userCompany?.id && userCompany?.name
              ? {
                  id: userCompany.id,
                  name: userCompany.name,
                }
              : null
          }
          skillsOptions={skillsOptions}
          certOptions={certOptions}
          initial={wizardInitial as any}
        />
      </div>
    </main>
  );
}