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

  const role = (session?.user as any)?.role as "RECRUITER" | "ADMIN" | string | undefined;
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

  function parseMetaFromDescription(desc: string) {
    const metaStart = desc.indexOf("\n---\n[Meta]\n");
    if (metaStart === -1) return {};
    const metaText = desc.slice(metaStart + "\n---\n[Meta]\n".length);
    const lines = metaText.split("\n").filter(Boolean);
    const out: any = {};
    for (const line of lines) {
      const parts = line.split(";").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        const eq = p.indexOf("=");
        if (eq === -1) continue;
        const key = p.slice(0, eq).trim();
        const val = p.slice(eq + 1).trim();
        if (val === "true" || val === "false") out[key] = val === "true";
        else if (!isNaN(Number(val))) out[key] = Number(val);
        else if (val.startsWith("{") || val.startsWith("[")) {
          try {
            out[key] = JSON.parse(val);
          } catch {}
        } else out[key] = val;
      }
    }
    return out;
  }

  function deserializeSkills(skills: string[] | null) {
    return (skills || []).map((s) => {
      const m = s.match(/^(?:Req|Nice)\s*:\s*(.+)$/i);
      const required = /^Req/i.test(s);
      return { name: m ? m[1] : s, required };
    });
  }

  const meta = parseMetaFromDescription(job.description || "");
  const description = (job.description || "").split("\n---\n[Meta]\n")[0] || "";
  const certs = meta.certifications || [];
  const benefitsJson = meta.benefits || {};
  const showSalary =
    typeof meta.showSalary === "boolean" ? meta.showSalary : !!(job.salaryMin || job.salaryMax);

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
    id: job.id, // 👈 BLINDAJE: se mandará en el FormData desde el wizard
    title: job.title,
    companyMode: job.company?.name === "Confidencial" ? "confidential" : "own",
    locationType,
    city,
    currency: job.currency || "MXN",
    salaryMin: job.salaryMin ?? "",
    salaryMax: job.salaryMax ?? "",
    showSalary,
    employmentType: job.employmentType || "FULL_TIME",
    schedule: meta.schedule || "",
    showBenefits: Boolean(meta.showBenefits),
    benefitsJson,
    description,
    responsibilities: meta.responsibilities || "",
    skills: deserializeSkills(job.skills),
    certs,
  };

  // ============= Server Action: UPDATE (nunca create) =============
  async function updateAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    const currentRole = (s?.user as any)?.role as "RECRUITER" | "ADMIN" | string | undefined;
    if (!s?.user || (currentRole !== "RECRUITER" && currentRole !== "ADMIN")) {
      return { error: "No autenticado o sin permisos." };
    }

    // Ownership (evita updates cruzados)
    if (currentRole === "RECRUITER") {
      const canEdit = await prisma.job.findFirst({
        where: { id: job.id, companyId: (s.user as any)?.companyId ?? undefined },
        select: { id: true },
      });
      if (!canEdit) return { error: "No tienes acceso a esta vacante." };
    }

    // (Opcional) si llegó jobId desde el wizard, que coincida
    const incomingJobId = (fd.get("jobId") || "").toString();
    if (incomingJobId && incomingJobId !== job.id) {
      return { error: "Inconsistencia de ID de vacante." };
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
    const benefitsJson = String(fd.get("benefitsJson") || "{}");
    const skillsJson = String(fd.get("skillsJson") || "[]");
    const certsJson = String(fd.get("certsJson") || "[]");
    const schedule = String(fd.get("schedule") || "");

    if (!title || !description)
      return { error: "Faltan campos obligatorios (título y descripción)." };

    let parsedSkills: Array<{ name: string; required: boolean }> = [];
    try {
      parsedSkills = JSON.parse(skillsJson || "[]");
    } catch {
      return { error: "Formato inválido en skillsJson." };
    }
    const skills = parsedSkills.map((x) => (x.required ? `Req: ${x.name}` : `Nice: ${x.name}`));

    let certsArr: string[] = [];
    try {
      certsArr = JSON.parse(certsJson || "[]");
    } catch {
      certsArr = [];
    }

    const remote = locationType === "REMOTE";
    const loc = remote ? "Remoto" : `${locationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${city}`;

    let locationLat: number | null = null;
    let locationLng: number | null = null;
    if (!remote && city) {
      const pt = await geocodeCityToPoint(city, "mx");
      if (pt) {
        locationLat = pt.lat;
        locationLng = pt.lng;
      }
    }

    // Cambiar empresa (own/confidencial) sin crear job nuevo
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
        : (await prisma.company.create({ data: { name: label }, select: { id: true } })).id;
      companyConnect = { connect: { id: confId } };
    }

    const descWithMeta =
      description +
      `\n\n---\n[Meta]\n` +
      `showSalary=${showSalary}; currency=${currency}; salaryMin=${salaryMin ?? ""}; salaryMax=${
        salaryMax ?? ""
      }\n` +
      `employmentType=${employmentType}; schedule=${schedule}\n` +
      `showBenefits=${showBenefits}; benefits=${benefitsJson}\n` +
      `responsibilities=${responsibilities}\n` +
      `certifications=${JSON.stringify(certsArr)}\n`;

    // UPDATE sobre el MISMO ID (nunca create)
    await prisma.job.update({
      where: { id: job.id },
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
        locationLat,
        locationLng,

        // Usa la relación recruiter (no recruiterId)
        recruiter: { connect: { id: (s.user as any)?.id } },

        ...(companyConnect ? { company: companyConnect } : {}),
      },
    });

    revalidatePath(`/dashboard/jobs/${job.id}`);
    revalidatePath(`/dashboard/jobs`);
    return { ok: true, redirectTo: "/dashboard/jobs" };
  }

  return (
    <main className="max-w-4xl p-6 space-y-6" key={`edit-${job.id}`}>
      <h2 className="text-2xl font-bold">Editar vacante</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Modifica los campos necesarios y guarda los cambios.
      </p>

      <JobWizard
        onSubmit={updateAction} // ← solo UPDATE; no hay POST aquí
        presetCompany={{ id: userCompany?.id ?? null, name: userCompany?.name ?? null }}
        skillsOptions={skillsOptions}
        certOptions={certOptions}
        initial={wizardInitial as any} // ← incluye { id: job.id }
      />
    </main>
  );
}
