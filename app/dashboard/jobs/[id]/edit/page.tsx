// app/dashboard/jobs/[id]/edit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import JobWizard from "../../new/JobWizard";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
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
  const job =
    role === "RECRUITER"
      ? await prisma.job.findFirst({
          where: { id: params.id, companyId: sessionCompanyId ?? undefined },
          include: { company: true },
        })
      : await prisma.job.findUnique({
          where: { id: params.id },
          include: { company: true },
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

  let locationType: "REMOTE" | "HYBRID" | "ONSITE" = "REMOTE";
  let city = "";
  if (!job.remote && job.location) {
    if (job.location.startsWith("Híbrido")) {
      locationType = "HYBRID";
      city = job.location.split("·")[1]?.trim() || "";
    } else {
      locationType = "ONSITE";
      city = job.location.split("·")[1]?.trim() || job.location;
    }
  }

  const wizardInitial = {
    id: job.id,
    title: job.title,
    companyMode: job.company?.name === "Confidencial" ? "confidential" : "own",
    locationType,
    city,
    currency: job.currency || "MXN",
    salaryMin: job.salaryMin ?? "",
    salaryMax: job.salaryMax ?? "",
    showSalary,
    employmentType:
      (meta.employmentType as string) || job.employmentType || "FULL_TIME",
    schedule,
    showBenefits,
    benefitsJson,
    description,
    responsibilities: meta.responsibilities || "",
    skills: deserializeSkills(job.skills),
    certs,
    // Educación si ya la usas en el wizard
    minDegree: (job as any).minDegree ?? null,
    educationJson: Array.isArray((job as any).educationJson)
      ? ((job as any).educationJson as any[])
      : [],
    // 👇 idiomas iniciales para el JobWizard
    languages,
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

    const hasBenefitsField = fd.has("benefitsJson");
    const minDegreeField = fd.get("minDegree");
    const hasEducationField = fd.has("educationJson");
    const educationJsonStr = String(fd.get("educationJson") || "[]");

    // 👇 idiomas desde el form
    const languagesJson = String(fd.get("languagesJson") || "[]");

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
    if (hasBenefitsField) {
      try {
        parsedBenefits = JSON.parse(benefitsJsonStr || "{}");
      } catch {
        parsedBenefits = {};
      }
    }

    const minDegree = minDegreeField ? String(minDegreeField) : null;

    let educationJson: any[] = [];
    if (hasEducationField) {
      try {
        educationJson = JSON.parse(educationJsonStr || "[]");
      } catch {
        educationJson = [];
      }
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

    const descWithMeta =
      description +
      `\n\n---\n[Meta]\n` +
      `showSalary=${showSalary}; currency=${currency}; salaryMin=${
        salaryMin ?? ""
      }; salaryMax=${salaryMax ?? ""}\n` +
      `employmentType=${employmentType}; schedule=${schedule}\n` +
      `showBenefits=${showBenefits}; benefits=${JSON.stringify(parsedBenefits)}\n` +
      `responsibilities=${responsibilities}\n` +
      `certifications=${JSON.stringify(certsArr)}\n` +
      `languages=${JSON.stringify(languagesArr)}\n`;

    await prisma.job.update({
      where: { id: jobId },
      data: {
        title,
        location: loc,
        remote,
        employmentType: employmentType as any,
        description: descWithMeta,
        skills,
        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        currency,
        showSalary,
        schedule: schedule || null,
        ...(hasBenefitsField ? { showBenefits, benefitsJson: parsedBenefits } : {}),
        ...(minDegreeField ? { minDegree: minDegree as any } : {}),
        ...(hasEducationField ? { educationJson } : {}),
        locationLat,
        locationLng,
        recruiter: { connect: { id: (s.user as any)?.id } },
        ...(companyConnect ? { company: companyConnect } : {}),
      },
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
          presetCompany={{
            id: userCompany?.id ?? null,
            name: userCompany?.name ?? null,
          }}
          skillsOptions={skillsOptions}
          certOptions={certOptions}
          initial={wizardInitial as any}
        />
      </div>
    </main>
  );
}
